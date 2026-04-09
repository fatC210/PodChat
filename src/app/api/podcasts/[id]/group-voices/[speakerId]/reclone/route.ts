import { NextResponse } from "next/server";
import { deleteElevenLabsVoice } from "@/lib/server/elevenlabs";
import { getReusableGroupSpeakerVoice } from "@/lib/server/podcast-voices";
import { getStoredPodcastAsset, updateStoredPodcast } from "@/lib/server/podcast-store";
import { readRequestIntegrationSettings } from "@/lib/server/request-integration-settings";
import { clonePodcastSpeakerVoice } from "@/lib/server/voice-cloning";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; speakerId: string }> },
) {
  void request;

  try {
    const { id, speakerId } = await context.params;
    const stored = await getStoredPodcastAsset(id);

    if (!stored) {
      return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
    }

    const speaker = stored.podcast.speakers.find((entry) => entry.id === speakerId);

    if (!speaker) {
      return NextResponse.json({ error: "Speaker not found." }, { status: 404 });
    }

    const currentProfile = stored.podcast.speakerProfiles.find((profile) => profile.speakerId === speakerId);

    if (!currentProfile) {
      return NextResponse.json({ error: "Speaker profile not found." }, { status: 404 });
    }

    const settings = readRequestIntegrationSettings(request);
    const reusableVoice = getReusableGroupSpeakerVoice(stored.podcast, speaker.id);

    if (reusableVoice) {
      if (currentProfile.groupVoiceId && currentProfile.groupVoiceId !== reusableVoice.voiceId) {
        try {
          await deleteElevenLabsVoice(settings, currentProfile.groupVoiceId);
        } catch {
          void 0;
        }
      }

      const podcast = await updateStoredPodcast(id, (current) => ({
        ...current,
        speakerProfiles: current.speakerProfiles.map((profile) =>
          profile.speakerId === speakerId
            ? {
                ...profile,
                displayName: speaker.name,
                groupVoiceId: reusableVoice.voiceId,
                groupVoiceName: reusableVoice.voiceName,
                groupVoiceStatus: "ready",
                groupVoiceError: null,
              }
            : profile,
        ),
      }));

      return NextResponse.json({ podcast });
    }

    try {
      const clonedVoice = await clonePodcastSpeakerVoice({
        settings,
        podcast: stored.podcast,
        assetPath: stored.uploadedFilePath,
        speakerId: speaker.id,
        speakerName: speaker.name,
      });

      if (currentProfile.groupVoiceId && currentProfile.groupVoiceId !== clonedVoice.voiceId) {
        try {
          await deleteElevenLabsVoice(settings, currentProfile.groupVoiceId);
        } catch {
          void 0;
        }
      }

      const podcast = await updateStoredPodcast(id, (current) => ({
        ...current,
        speakerProfiles: current.speakerProfiles.map((profile) =>
          profile.speakerId === speakerId
            ? {
                ...profile,
                displayName: speaker.name,
                groupVoiceId: clonedVoice.voiceId,
                groupVoiceName: clonedVoice.voiceName,
                groupVoiceStatus: clonedVoice.voiceId ? "ready" : "failed",
                groupVoiceError: clonedVoice.voiceId ? null : "Voice cloning did not return a voice ID.",
              }
            : profile,
        ),
      }));

      return NextResponse.json({ podcast });
    } catch (error) {
      const podcast = await updateStoredPodcast(id, (current) => ({
        ...current,
        speakerProfiles: current.speakerProfiles.map((profile) =>
          profile.speakerId === speakerId
            ? {
                ...profile,
                displayName: speaker.name,
                groupVoiceStatus: profile.groupVoiceId ? "ready" : "failed",
                groupVoiceError: error instanceof Error ? error.message : "Failed to clone the group voice.",
              }
            : profile,
        ),
      }));

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to reclone the group voice.",
          podcast,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reclone the group voice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
