import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSummary, isPodcastReady, summaryDurations } from "@/lib/podchat-data";
import { getStoredPodcast } from "@/lib/server/podcast-store";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";
import { synthesizeTextWithElevenLabs } from "@/lib/server/elevenlabs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const podcast = await getStoredPodcast(id);

    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
    }

    if (!isPodcastReady(podcast)) {
      return NextResponse.json({ error: "Podcast is not ready for summary audio." }, { status: 400 });
    }

    const url = new URL(request.url);
    const duration = Number(url.searchParams.get("dur"));

    if (!summaryDurations.includes(duration as (typeof summaryDurations)[number])) {
      return NextResponse.json({ error: "Summary duration is invalid." }, { status: 400 });
    }

    const summary = getSummary(podcast, duration);

    if (!summary) {
      return NextResponse.json({ error: "Summary not found." }, { status: 404 });
    }

    const settings = await readStoredIntegrationSettings();
    const text = summary.text;
    const synthesis = await synthesizeTextWithElevenLabs(settings, {
      text,
      cacheKeyParts: ["summary-audio", podcast.id, String(duration)],
      voiceIdOverride: podcast.aiHostVoiceId,
      emotion: summary.emotion,
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
    const message = error instanceof Error ? error.message : "Failed to synthesize summary audio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
