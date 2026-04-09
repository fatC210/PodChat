import { NextResponse } from "next/server";
import { getStoredPodcastAsset, updateStoredPodcast } from "@/lib/server/podcast-store";
import { ensureBaseAgent } from "@/lib/server/elevenlabs-agents";
import { deleteElevenLabsVoice } from "@/lib/server/elevenlabs";
import { readRequestIntegrationSettings } from "@/lib/server/request-integration-settings";
import { clonePodcastSpeakerVoice } from "@/lib/server/voice-cloning";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      speakerId?: string;
    };

    if (!body.speakerId) {
      return NextResponse.json({ error: "Speaker ID is required." }, { status: 400 });
    }

    const stored = await getStoredPodcastAsset(id);

    if (!stored) {
      return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
    }

    const selectedSpeaker = stored.podcast.speakers.find((speaker) => speaker.id === body.speakerId);

    if (!selectedSpeaker) {
      return NextResponse.json({ error: "Selected speaker was not found." }, { status: 404 });
    }

    const settings = readRequestIntegrationSettings(request);
    const previousVoiceId = stored.podcast.aiHostVoiceId;
    const clonedVoice = await clonePodcastSpeakerVoice({
      settings,
      podcast: stored.podcast,
      assetPath: stored.uploadedFilePath,
      speakerId: selectedSpeaker.id,
      speakerName: selectedSpeaker.name,
    });

    if (previousVoiceId && previousVoiceId !== clonedVoice.voiceId) {
      try {
        await deleteElevenLabsVoice(settings, previousVoiceId);
      } catch {
        void 0;
      }
    }

    try {
      await ensureBaseAgent(settings);
    } catch {
      void 0;
    }

    const otherSpeaker = stored.podcast.speakers.find((speaker) => speaker.id !== selectedSpeaker.id);
    const updated = await updateStoredPodcast(id, (podcast) => ({
      ...podcast,
      aiHostSpeakerId: selectedSpeaker.id,
      aiHost: selectedSpeaker.name,
      aiHostVoiceId: clonedVoice.voiceId,
      aiHostVoiceName: clonedVoice.voiceName,
      guestName: otherSpeaker?.name ?? "",
      processingError: null,
    }));

    return NextResponse.json({ podcast: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clone host voice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
