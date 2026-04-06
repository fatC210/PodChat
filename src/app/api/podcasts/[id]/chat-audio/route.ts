import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getStoredPodcast } from "@/lib/server/podcast-store";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";
import { synthesizeTextWithElevenLabs } from "@/lib/server/elevenlabs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const podcast = await getStoredPodcast(id);

    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
    }

    const body = (await request.json()) as {
      text?: string;
    };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "Chat text is required." }, { status: 400 });
    }

    const settings = await readStoredIntegrationSettings();
    const synthesis = await synthesizeTextWithElevenLabs(settings, {
      text,
      cacheKeyParts: ["chat-audio", podcast.id],
      voiceIdOverride: podcast.aiHostVoiceId,
    });
    const audioBytes = await readFile(synthesis.audioPath);

    return new NextResponse(audioBytes, {
      headers: {
        "Content-Type": synthesis.contentType,
        "Content-Length": String(audioBytes.length),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to synthesize chat audio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
