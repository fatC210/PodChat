import { NextResponse } from "next/server";
import { normalizeIntegrationSettings, type IntegrationSettings } from "@/lib/podchat-data";
import { getConversationToken } from "@/lib/server/elevenlabs-agents";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      settings?: Partial<IntegrationSettings>;
    };
    const result = await getConversationToken(normalizeIntegrationSettings(body.settings));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start ElevenLabs agent session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
