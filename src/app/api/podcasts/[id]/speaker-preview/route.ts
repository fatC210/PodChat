import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getStoredPodcastAsset } from "@/lib/server/podcast-store";
import { preparePodcastSpeakerSampleAudio } from "@/lib/server/voice-cloning";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const speakerId = url.searchParams.get("speakerId")?.trim();

    if (!speakerId) {
      return NextResponse.json({ error: "Speaker ID is required." }, { status: 400 });
    }

    const stored = await getStoredPodcastAsset(id);

    if (!stored) {
      return NextResponse.json({ error: "Podcast asset not found." }, { status: 404 });
    }

    const selectedSpeaker = stored.podcast.speakers.find((speaker) => speaker.id === speakerId);

    if (!selectedSpeaker) {
      return NextResponse.json({ error: "Selected speaker was not found." }, { status: 404 });
    }

    const sample = await preparePodcastSpeakerSampleAudio({
      assetPath: stored.uploadedFilePath,
      podcast: stored.podcast,
      speakerId,
      maxDurationSeconds: 20,
      maxSegments: 4,
    });

    try {
      const audioBytes = await readFile(sample.samplePath);

      return new NextResponse(audioBytes, {
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(audioBytes.length),
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": `inline; filename="${encodeURIComponent(`${id}-${selectedSpeaker.id}-preview.wav`)}"`,
        },
      });
    } finally {
      await sample.cleanup();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate speaker preview audio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
