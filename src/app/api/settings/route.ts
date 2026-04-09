import { NextResponse } from "next/server";
import {
  defaultIntegrationSettings,
  normalizeIntegrationSettings,
  type IntegrationSettings,
} from "@/lib/podchat-data";

export async function GET() {
  return NextResponse.json({ settings: defaultIntegrationSettings });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      settings?: Partial<IntegrationSettings>;
    };

    if (!body?.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }

    return NextResponse.json({ settings: normalizeIntegrationSettings(body.settings) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
