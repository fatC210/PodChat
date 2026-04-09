import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSummary, isPodcastReady, normalizeSummaryEmotion, summaryDurations } from "@/lib/podchat-data";
import { getStoredPodcast } from "@/lib/server/podcast-store";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";
import { synthesizePodcastAudioWithRecovery } from "@/lib/server/podcast-audio";
import { ensureSummaryTranslation } from "@/lib/server/summary-translations";

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
    const targetLang = url.searchParams.get("lang")?.trim() ?? "";
    const requestedEmotion = url.searchParams.get("emotion");
    const normalizedEmotion = normalizeSummaryEmotion(requestedEmotion);

    if (requestedEmotion && !normalizedEmotion) {
      return NextResponse.json({ error: "Summary emotion is invalid." }, { status: 400 });
    }

    const playbackEmotion = normalizedEmotion ?? summary.emotion;
    const resolvedSummaryText = targetLang
      ? (await ensureSummaryTranslation({
          podcast,
          duration,
          targetLang,
          settings,
        })).text
      : summary.text;
    const synthesis = await synthesizePodcastAudioWithRecovery({
      settings,
      podcastId: podcast.id,
      text: resolvedSummaryText,
      cacheKeyParts: ["summary-audio", podcast.id, String(duration), targetLang || "original", playbackEmotion],
      voiceIdOverride: podcast.aiHostVoiceId,
      emotion: playbackEmotion,
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
