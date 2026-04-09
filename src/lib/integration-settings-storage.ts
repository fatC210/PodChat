import {
  defaultIntegrationSettings,
  normalizeIntegrationSettings,
  type IntegrationSettings,
} from "@/lib/podchat-data";

export const clientStateStorageKey = "podchat_client_state_v3";
export const legacyStorageKey = "podchat_app_data_v2";

export function readStoredIntegrationSettingsFromLocalStorage() {
  if (typeof window === "undefined") {
    return defaultIntegrationSettings;
  }

  const rawState =
    window.localStorage.getItem(clientStateStorageKey) ??
    window.localStorage.getItem(legacyStorageKey);

  if (!rawState) {
    return defaultIntegrationSettings;
  }

  try {
    const parsed = JSON.parse(rawState) as {
      integrationSettings?: Partial<IntegrationSettings>;
    };

    return normalizeIntegrationSettings(parsed.integrationSettings);
  } catch {
    return defaultIntegrationSettings;
  }
}

export function writeStoredIntegrationSettingsToLocalStorage(settings: IntegrationSettings) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSettings = normalizeIntegrationSettings(settings);
  const rawState = window.localStorage.getItem(clientStateStorageKey);

  try {
    const parsed = rawState ? (JSON.parse(rawState) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      clientStateStorageKey,
      JSON.stringify({
        ...parsed,
        integrationSettings: normalizedSettings,
      }),
    );
  } catch {
    window.localStorage.setItem(
      clientStateStorageKey,
      JSON.stringify({
        integrationSettings: normalizedSettings,
        podcastClientState: {},
      }),
    );
  }
}
