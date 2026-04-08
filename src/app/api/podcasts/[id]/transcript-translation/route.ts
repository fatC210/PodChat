import { NextResponse } from "next/server";
import { ensureTranscriptTranslation } from "@/lib/server/transcript-translations";
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

    if (podcast.transcript.length === 0) {
      return NextResponse.json({ error: "Podcast transcript is unavailable." }, { status: 400 });
    }

    const body = (await request.json()) as {
      targetLang?: string;
    };
    const targetLang = body.targetLang?.trim() ?? "";
    const settings = await readStoredIntegrationSettings();
    const result = await ensureTranscriptTranslation({
      podcast,
      targetLang,
      settings,
    });

    return NextResponse.json({
      targetLang: result.targetLang,
      translations: result.translations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to translate transcript.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
