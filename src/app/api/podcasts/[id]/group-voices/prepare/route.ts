import { NextResponse } from "next/server";
import { getStoredPodcastAsset, updateStoredPodcast } from "@/lib/server/podcast-store";
import { getReusableGroupSpeakerVoice } from "@/lib/server/podcast-voices";
import { readRequestIntegrationSettings } from "@/lib/server/request-integration-settings";
import { clonePodcastSpeakerVoice } from "@/lib/server/voice-cloning";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  void request;

  try {
    const { id } = await context.params;
    const stored = await getStoredPodcastAsset(id);

    if (!stored) {
      return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
    }

    const settings = readRequestIntegrationSettings(request);
    const nextProfiles = [...stored.podcast.speakerProfiles];

    for (const [index, profile] of nextProfiles.entries()) {
      if (profile.groupVoiceStatus === "ready" && profile.groupVoiceId) {
        continue;
      }

      const speaker = stored.podcast.speakers.find((entry) => entry.id === profile.speakerId);

      if (!speaker) {
        nextProfiles[index] = {
          ...profile,
          groupVoiceStatus: "failed",
          groupVoiceError: "The speaker record is missing.",
        };
        continue;
      }

      const reusableVoice = getReusableGroupSpeakerVoice(stored.podcast, speaker.id);

      if (reusableVoice) {
        nextProfiles[index] = {
          ...profile,
          displayName: speaker.name,
          groupVoiceId: reusableVoice.voiceId,
          groupVoiceName: reusableVoice.voiceName,
          groupVoiceStatus: "ready",
          groupVoiceError: null,
        };
        continue;
      }

      try {
        const clonedVoice = await clonePodcastSpeakerVoice({
          settings,
          podcast: stored.podcast,
          assetPath: stored.uploadedFilePath,
          speakerId: speaker.id,
          speakerName: speaker.name,
        });

        nextProfiles[index] = {
          ...profile,
          displayName: speaker.name,
          groupVoiceId: clonedVoice.voiceId,
          groupVoiceName: clonedVoice.voiceName,
          groupVoiceStatus: clonedVoice.voiceId ? "ready" : "failed",
          groupVoiceError: clonedVoice.voiceId ? null : "Voice cloning did not return a voice ID.",
        };
      } catch (error) {
        nextProfiles[index] = {
          ...profile,
          displayName: speaker.name,
          groupVoiceStatus: "failed",
          groupVoiceError: error instanceof Error ? error.message : "Failed to clone the group voice.",
        };
      }
    }

    const podcast = await updateStoredPodcast(id, (current) => ({
      ...current,
      speakerProfiles: nextProfiles,
      processingError: null,
    }));

    return NextResponse.json({ podcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare group voices.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
