import { NextResponse } from "next/server";
import { normalizeIntegrationSettings, type IntegrationSettings } from "@/lib/podchat-data";
import { enqueueConfiguringPodcasts } from "@/lib/server/podcast-processing";
import {
  readStoredIntegrationSettings,
  writeStoredIntegrationSettings,
} from "@/lib/server/settings-store";

export async function GET() {
  const settings = await readStoredIntegrationSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      settings?: Partial<IntegrationSettings>;
    };

    if (!body?.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }

    const settings = await writeStoredIntegrationSettings(normalizeIntegrationSettings(body.settings));
    await enqueueConfiguringPodcasts();
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
