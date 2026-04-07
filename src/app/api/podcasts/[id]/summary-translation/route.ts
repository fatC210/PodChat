import { NextResponse } from "next/server";
import { getSummary, isPodcastReady, summaryDurations } from "@/lib/podchat-data";
import { ensureSummaryTranslation } from "@/lib/server/summary-translations";
import { getStoredPodcast } from "@/lib/server/podcast-store";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";

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

    if (!isPodcastReady(podcast)) {
      return NextResponse.json({ error: "Podcast is not ready for summary translation." }, { status: 400 });
    }

    const body = (await request.json()) as {
      duration?: number;
      targetLang?: string;
    };
    const duration = Number(body.duration);
    const targetLang = body.targetLang?.trim() ?? "";

    if (!summaryDurations.includes(duration as (typeof summaryDurations)[number])) {
      return NextResponse.json({ error: "Summary duration is invalid." }, { status: 400 });
    }

    if (!getSummary(podcast, duration)) {
      return NextResponse.json({ error: "Summary not found." }, { status: 404 });
    }

    const settings = await readStoredIntegrationSettings();
    const result = await ensureSummaryTranslation({
      podcast,
      duration,
      targetLang,
      settings,
    });

    return NextResponse.json({
      text: result.text,
      podcast: result.podcast,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to translate summary.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
