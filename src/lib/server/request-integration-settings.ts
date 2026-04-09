import "server-only";

import {
  defaultIntegrationSettings,
  normalizeIntegrationSettings,
  type IntegrationSettings,
} from "@/lib/podchat-data";
import { integrationSettingsHeaderName } from "@/lib/integration-settings-header";

export function getIntegrationSettingsHeaderName() {
  return integrationSettingsHeaderName;
}

export function readRequestIntegrationSettings(request: Request) {
  const encoded = request.headers.get(integrationSettingsHeaderName);

  if (!encoded) {
    return defaultIntegrationSettings;
  }

  try {
    return normalizeIntegrationSettings(
      JSON.parse(decodeURIComponent(encoded)) as Partial<IntegrationSettings>,
    );
  } catch {
    return defaultIntegrationSettings;
  }
}
