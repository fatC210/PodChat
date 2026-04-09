import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultIntegrationSettings,
  normalizeIntegrationSettings,
  type IntegrationSettings,
} from "@/lib/podchat-data";
import { getPodChatDataDir, preparePodChatDataDir } from "@/lib/server/podchat-data-dir";

interface SettingsRuntime {
  writeChain: Promise<void>;
}

const dataDir = getPodChatDataDir();
const settingsPath = path.join(dataDir, "settings.json");

function getSettingsRuntime() {
  const scopedGlobal = globalThis as typeof globalThis & {
    __podchatSettingsRuntime?: SettingsRuntime;
  };

  if (!scopedGlobal.__podchatSettingsRuntime) {
    scopedGlobal.__podchatSettingsRuntime = {
      writeChain: Promise.resolve(),
    };
  }

  return scopedGlobal.__podchatSettingsRuntime;
}

async function ensureSettingsFile() {
  await preparePodChatDataDir();
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(settingsPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await writeFile(settingsPath, JSON.stringify(defaultIntegrationSettings, null, 2), "utf8");
  }
}

export async function readStoredIntegrationSettings() {
  await ensureSettingsFile();
  const raw = await readFile(settingsPath, "utf8");

  try {
    return normalizeIntegrationSettings(JSON.parse(raw) as Partial<IntegrationSettings>);
  } catch {
    return defaultIntegrationSettings;
  }
}

export async function writeStoredIntegrationSettings(settings: IntegrationSettings) {
  const normalized = normalizeIntegrationSettings(settings);
  const runtime = getSettingsRuntime();

  runtime.writeChain = runtime.writeChain.then(async () => {
    await ensureSettingsFile();
    const tempPath = `${settingsPath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(normalized, null, 2), "utf8");
    await rename(tempPath, settingsPath);
  });

  await runtime.writeChain;
  return normalized;
}
