import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { timeToSeconds, type IntegrationSettings, type Podcast, type TranscriptLine } from "@/lib/podchat-data";
import { hasElevenLabsConfig } from "@/lib/server/elevenlabs";
import { fetchWithUpstreamErrorContext, readUpstreamError } from "@/lib/server/integrations";

const tempRootDir = path.join(/* turbopackIgnore: true */ process.cwd(), ".podchat", "tmp");

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

function getLineBounds(line: TranscriptLine, nextLine?: TranscriptLine | undefined) {
  const start = timeToSeconds(line.time);
  const explicitEnd = line.endTime ? timeToSeconds(line.endTime) : null;
  const nextStart = nextLine ? timeToSeconds(nextLine.time) : null;
  const end = explicitEnd ?? (nextStart ? Math.max(start + 1, nextStart - 0.1) : start + 8);

  return {
    start,
    duration: Math.max(1.5, end - start),
  };
}

function selectSpeakerSegments(
  podcast: Podcast,
  speakerId: string,
  options?: {
    maxDurationSeconds?: number;
    maxSegments?: number;
  },
) {
  const maxDurationSeconds = options?.maxDurationSeconds ?? 45;
  const maxSegments = options?.maxSegments ?? 6;
  const matchingLines = podcast.transcript
    .map((line, index) => ({
      line,
      nextLine: podcast.transcript[index + 1],
    }))
    .filter(({ line }) => (line.speakerId ?? line.speaker) === speakerId);

  let totalDuration = 0;
  const segments: Array<{ start: number; duration: number }> = [];

  for (const { line, nextLine } of matchingLines) {
    const bounds = getLineBounds(line, nextLine);

    if (totalDuration >= maxDurationSeconds) {
      break;
    }

    const remaining = maxDurationSeconds - totalDuration;
    const duration = Math.min(bounds.duration, remaining);
    segments.push({
      start: bounds.start,
      duration,
    });
    totalDuration += duration;

    if (segments.length >= maxSegments) {
      break;
    }
  }

  return segments;
}

export async function preparePodcastSpeakerSampleAudio(input: {
  assetPath: string;
  podcast: Podcast;
  speakerId: string;
  maxDurationSeconds?: number;
  maxSegments?: number;
}) {
  const { assetPath, podcast, speakerId, maxDurationSeconds, maxSegments } = input;
  const segments = selectSpeakerSegments(podcast, speakerId, {
    maxDurationSeconds,
    maxSegments,
  });

  if (segments.length === 0) {
    throw new Error("No transcript segments were found for the selected speaker.");
  }

  const tempDir = path.join(tempRootDir, randomUUID());
  await mkdir(tempDir, { recursive: true });

  try {
    const clipPaths: string[] = [];

    for (const [index, segment] of segments.entries()) {
      const clipPath = path.join(tempDir, `clip-${index + 1}.wav`);
      await runFfmpeg([
        "-y",
        "-ss",
        segment.start.toFixed(2),
        "-t",
        segment.duration.toFixed(2),
        "-i",
        assetPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "44100",
        clipPath,
      ]);
      clipPaths.push(clipPath);
    }

    if (clipPaths.length === 1) {
      return {
        samplePath: clipPaths[0],
        cleanup: async () => {
          await rm(tempDir, { recursive: true, force: true });
        },
      };
    }

    const concatListPath = path.join(tempDir, "concat.txt");
    await writeFile(
      concatListPath,
      clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf8",
    );

    const mergedPath = path.join(tempDir, "speaker-sample.wav");
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c",
      "copy",
      mergedPath,
    ]);

    return {
      samplePath: mergedPath,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export async function clonePodcastSpeakerVoice(input: {
  settings: Pick<IntegrationSettings, "elevenlabs">;
  podcast: Podcast;
  assetPath: string;
  speakerId: string;
  speakerName: string;
}) {
  const { settings, podcast, assetPath, speakerId, speakerName } = input;

  if (!hasElevenLabsConfig(settings)) {
    throw new Error("ElevenLabs API key is required for voice cloning.");
  }

  const sample = await preparePodcastSpeakerSampleAudio({
    assetPath,
    podcast,
    speakerId,
  });

  try {
    const sampleBytes = new Uint8Array(await readFile(sample.samplePath));
    const formData = new FormData();
    formData.set("name", `PodChat ${podcast.title} ${speakerName}`.slice(0, 100));
    formData.set("description", `Cloned from podcast ${podcast.id} speaker ${speakerName}`);
    formData.append(
      "files",
      new File([sampleBytes], `${speakerId}.wav`, {
        type: "audio/wav",
      }),
    );

    const response = await fetchWithUpstreamErrorContext("ElevenLabs voice cloning API", "https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": settings.elevenlabs,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readUpstreamError(response));
    }

    const payload = (await response.json()) as {
      voice_id?: string;
      name?: string;
    };

    if (!payload.voice_id) {
      throw new Error("ElevenLabs did not return a cloned voice ID.");
    }

    return {
      voiceId: payload.voice_id,
      voiceName: payload.name?.trim() || speakerName,
    };
  } finally {
    await sample.cleanup();
  }
}
