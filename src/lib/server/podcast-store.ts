import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPodcastFromWizard, normalizePodcastSummaries, type Podcast, type SavePodcastInput } from "@/lib/podchat-data";
import { normalizeDisplayDuration } from "@/lib/transcript-duration";

interface StoredPodcast extends Podcast {
  uploadedFilePath: string;
}

interface PodcastDatabase {
  podcasts: StoredPodcast[];
}

interface StoreRuntime {
  writeChain: Promise<void>;
}

const dataDir = path.join(process.cwd(), ".podchat");
const uploadsDir = path.join(dataDir, "uploads");
const databasePath = path.join(dataDir, "podcasts.json");
const initialDatabase: PodcastDatabase = {
  podcasts: [],
};

function sortStoredPodcasts(podcasts: StoredPodcast[]) {
  return [...podcasts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function normalizeStoredPodcast(storedPodcast: StoredPodcast): StoredPodcast {
  const duration =
    storedPodcast.transcript.length > 0
      ? normalizeDisplayDuration(storedPodcast.duration, storedPodcast.transcript)
      : storedPodcast.duration;

  return {
    ...storedPodcast,
    duration,
    summaries: normalizePodcastSummaries(storedPodcast.summaries),
  };
}

function getStoreRuntime() {
  const scopedGlobal = globalThis as typeof globalThis & {
    __podchatStoreRuntime?: StoreRuntime;
  };

  if (!scopedGlobal.__podchatStoreRuntime) {
    scopedGlobal.__podchatStoreRuntime = {
      writeChain: Promise.resolve(),
    };
  }

  return scopedGlobal.__podchatStoreRuntime;
}

async function ensureStoreFiles() {
  await mkdir(uploadsDir, { recursive: true });

  try {
    await readFile(databasePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await writeFile(databasePath, JSON.stringify(initialDatabase, null, 2), "utf8");
  }
}

async function readDatabase() {
  await ensureStoreFiles();

  const raw = await readFile(databasePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<PodcastDatabase>;

  return {
    podcasts: Array.isArray(parsed.podcasts) ? parsed.podcasts : [],
  } as PodcastDatabase;
}

async function writeDatabase(nextDatabase: PodcastDatabase) {
  const runtime = getStoreRuntime();

  runtime.writeChain = runtime.writeChain.then(async () => {
    await ensureStoreFiles();
    const tempPath = `${databasePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(nextDatabase, null, 2), "utf8");
    await rename(tempPath, databasePath);
  });

  await runtime.writeChain;
}

function stripStoredFields(storedPodcast: StoredPodcast): Podcast {
  const normalizedPodcast = normalizeStoredPodcast(storedPodcast);
  const { uploadedFilePath, ...podcast } = normalizedPodcast;
  return podcast;
}

async function updateDatabase(
  updater: (database: PodcastDatabase) => PodcastDatabase,
): Promise<PodcastDatabase> {
  const current = await readDatabase();
  const next = updater(current);
  await writeDatabase(next);
  return next;
}

export async function listStoredPodcasts() {
  const database = await readDatabase();
  return sortStoredPodcasts(database.podcasts).map(stripStoredFields);
}

export async function getStoredPodcast(id: string) {
  const database = await readDatabase();
  const storedPodcast = database.podcasts.find((podcast) => podcast.id === id);
  return storedPodcast ? stripStoredFields(storedPodcast) : null;
}

export async function getStoredPodcastAsset(id: string) {
  const database = await readDatabase();
  const storedPodcast = database.podcasts.find((podcast) => podcast.id === id);

  if (!storedPodcast) {
    return null;
  }

  return {
    podcast: stripStoredFields(storedPodcast),
    uploadedFilePath: storedPodcast.uploadedFilePath,
    sourceFileName: storedPodcast.sourceFileName,
  };
}

export async function createStoredPodcast(input: SavePodcastInput, file: File) {
  const podcast = buildPodcastFromWizard(input);
  const fileExtension = path.extname(file.name || input.sourceFileName || "") || ".bin";
  const storedFilePath = path.join(dataDir, "uploads", `${podcast.id}${fileExtension}`);
  const storedPodcast: StoredPodcast = {
    ...podcast,
    uploadedFilePath: storedFilePath,
  };

  const fileBytes = Buffer.from(await file.arrayBuffer());

  await ensureStoreFiles();
  await writeFile(storedFilePath, fileBytes);
  await updateDatabase((database) => ({
    podcasts: sortStoredPodcasts([storedPodcast, ...database.podcasts.filter((entry) => entry.id !== podcast.id)]),
  }));

  return stripStoredFields(storedPodcast);
}

export async function patchStoredPodcast(id: string, patch: Partial<Podcast>) {
  let updatedPodcast: Podcast | null = null;

  await updateDatabase((database) => ({
    podcasts: sortStoredPodcasts(
      database.podcasts.map((podcast) => {
        if (podcast.id !== id) {
          return podcast;
        }

        const nextPodcast = {
          ...podcast,
          ...patch,
          id: podcast.id,
        };

        updatedPodcast = stripStoredFields(nextPodcast);
        return nextPodcast;
      }),
    ),
  }));

  return updatedPodcast;
}

export async function updateStoredPodcast(
  id: string,
  updater: (podcast: Podcast) => Podcast,
) {
  let updatedPodcast: Podcast | null = null;

  await updateDatabase((database) => ({
    podcasts: sortStoredPodcasts(
      database.podcasts.map((storedPodcast) => {
        if (storedPodcast.id !== id) {
          return storedPodcast;
        }

        const nextPodcast = updater(stripStoredFields(storedPodcast));
        const nextStoredPodcast: StoredPodcast = {
          ...storedPodcast,
          ...nextPodcast,
          uploadedFilePath: storedPodcast.uploadedFilePath,
        };

        updatedPodcast = stripStoredFields(nextStoredPodcast);
        return nextStoredPodcast;
      }),
    ),
  }));

  return updatedPodcast;
}

export async function deleteStoredPodcast(id: string) {
  let deletedFilePath = "";
  let deleted = false;

  await updateDatabase((database) => ({
    podcasts: database.podcasts.filter((podcast) => {
      if (podcast.id !== id) {
        return true;
      }

      deletedFilePath = podcast.uploadedFilePath;
      deleted = true;
      return false;
    }),
  }));

  if (deletedFilePath) {
    await rm(deletedFilePath, { force: true });
  }

  return deleted;
}
