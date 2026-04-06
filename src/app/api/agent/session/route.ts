import { NextResponse } from "next/server";
import { getStoredConversationToken } from "@/lib/server/elevenlabs-agents";

export async function POST() {
  try {
    const result = await getStoredConversationToken();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start ElevenLabs agent session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
