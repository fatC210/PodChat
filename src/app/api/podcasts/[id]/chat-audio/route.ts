import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { normalizeSummaryEmotion } from "@/lib/podchat-data";
import { getStoredPodcast } from "@/lib/server/podcast-store";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";
import { synthesizePodcastAudioWithRecovery } from "@/lib/server/podcast-audio";

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
      speakerId?: string;
      emotion?: string;
      speechStyle?: string;
    };
    const text = body.text?.trim();
    const speechStyle = body.speechStyle?.trim();

    if (!text) {
      return NextResponse.json({ error: "Chat text is required." }, { status: 400 });
    }

    const normalizedEmotion =
      body.emotion?.trim().toLowerCase() === "neutral"
        ? "neutral"
        : normalizeSummaryEmotion(body.emotion);

    if (body.emotion && !normalizedEmotion) {
      return NextResponse.json({ error: "Chat speech emotion is invalid." }, { status: 400 });
    }

    const playbackEmotion =
      normalizedEmotion ??
      normalizeSummaryEmotion(speechStyle) ??
      "neutral";

    const speakerProfile = body.speakerId
      ? podcast.speakerProfiles.find((profile) => profile.speakerId === body.speakerId)
      : null;
    const settings = await readStoredIntegrationSettings();
    const voiceIdOverride = speakerProfile?.groupVoiceId ?? podcast.aiHostVoiceId;
    const synthesis = await synthesizePodcastAudioWithRecovery({
      settings,
      podcastId: podcast.id,
      speakerId: body.speakerId,
      text,
      cacheKeyParts: [
        "chat-audio",
        podcast.id,
        body.speakerId?.trim() || "default",
        playbackEmotion,
        speechStyle || "default-style",
      ],
      voiceIdOverride,
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
    const message = error instanceof Error ? error.message : "Failed to synthesize chat audio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
