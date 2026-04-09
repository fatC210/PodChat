import "server-only";

import { cp, mkdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface PodChatDataDirRuntime {
  preparePromise: Promise<void> | null;
}

function getDefaultPodChatDataDir() {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "PodChat");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "PodChat");
  }

  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdgDataHome, "podchat");
}

export function getPodChatDataDir() {
  const configuredDir = process.env.PODCHAT_DATA_DIR?.trim();

  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  return getDefaultPodChatDataDir();
}

function getLegacyPodChatDataDir() {
  return path.join(process.cwd(), ".podchat");
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function getPodChatDataDirRuntime() {
  const scopedGlobal = globalThis as typeof globalThis & {
    __podchatDataDirRuntime?: PodChatDataDirRuntime;
  };

  if (!scopedGlobal.__podchatDataDirRuntime) {
    scopedGlobal.__podchatDataDirRuntime = {
      preparePromise: null,
    };
  }

  return scopedGlobal.__podchatDataDirRuntime;
}

export async function preparePodChatDataDir() {
  const runtime = getPodChatDataDirRuntime();

  if (!runtime.preparePromise) {
    runtime.preparePromise = (async () => {
      const dataDir = getPodChatDataDir();
      const legacyDataDir = getLegacyPodChatDataDir();

      if (await pathExists(dataDir)) {
        return;
      }

      await mkdir(path.dirname(dataDir), { recursive: true });

      if (dataDir !== legacyDataDir && await pathExists(legacyDataDir)) {
        await cp(legacyDataDir, dataDir, { recursive: true });
        return;
      }

      await mkdir(dataDir, { recursive: true });
    })();
  }

  await runtime.preparePromise;
}
