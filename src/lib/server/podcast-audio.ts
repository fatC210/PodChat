import "server-only";

import type { IntegrationSettings, Podcast, SummaryEmotion } from "@/lib/podchat-data";
import {
  isElevenLabsVoiceNotFoundErrorMessage,
  synthesizeTextWithElevenLabs,
} from "@/lib/server/elevenlabs";
import { normalizeValue } from "@/lib/server/integrations";
import { getStoredPodcastAsset, updateStoredPodcast } from "@/lib/server/podcast-store";
import { clonePodcastSpeakerVoice } from "@/lib/server/voice-cloning";

interface RecoveryTarget {
  kind: "host" | "group";
  speakerId: string;
  voiceId: string;
}

interface RecoverMissingPodcastVoiceInput {
  settings: Pick<IntegrationSettings, "elevenlabs">;
  podcastId: string;
  missingVoiceId?: string | null;
  speakerId?: string | null;
}

interface SynthesizePodcastAudioWithRecoveryInput {
  settings: Pick<IntegrationSettings, "elevenlabs" | "elevenlabsVoiceId">;
  podcastId: string;
  speakerId?: string | null;
  text: string;
  cacheKeyParts: string[];
  voiceIdOverride?: string | null;
  emotion?: SummaryEmotion | "neutral";
  languageCode?: "zh" | "en";
}

function resolveRecoveryTarget(
  podcast: Podcast,
  input: {
    missingVoiceId?: string | null;
    speakerId?: string | null;
  },
) {
  const missingVoiceId = normalizeValue(input.missingVoiceId);
  const speakerId = normalizeValue(input.speakerId);

  if (missingVoiceId) {
    const matchingProfile = podcast.speakerProfiles.find(
      (profile) => normalizeValue(profile.groupVoiceId) === missingVoiceId,
    );

    if (matchingProfile) {
      return {
        kind: "group" as const,
        speakerId: matchingProfile.speakerId,
        voiceId: missingVoiceId,
      };
    }

    if (normalizeValue(podcast.aiHostVoiceId) === missingVoiceId && normalizeValue(podcast.aiHostSpeakerId)) {
      return {
        kind: "host" as const,
        speakerId: normalizeValue(podcast.aiHostSpeakerId),
        voiceId: missingVoiceId,
      };
    }
  }

  if (!speakerId) {
    return null;
  }

  const matchingProfile = podcast.speakerProfiles.find((profile) => profile.speakerId === speakerId);
  const groupVoiceId = normalizeValue(matchingProfile?.groupVoiceId);

  if (groupVoiceId) {
    return {
      kind: "group" as const,
      speakerId,
      voiceId: groupVoiceId,
    };
  }

  if (speakerId === normalizeValue(podcast.aiHostSpeakerId) && normalizeValue(podcast.aiHostVoiceId)) {
    return {
      kind: "host" as const,
      speakerId,
      voiceId: normalizeValue(podcast.aiHostVoiceId),
    };
  }

  return null;
}

function getTargetVoiceId(podcast: Podcast, target: RecoveryTarget) {
  if (target.kind === "host") {
    return normalizeValue(podcast.aiHostVoiceId);
  }

  const matchingProfile = podcast.speakerProfiles.find((profile) => profile.speakerId === target.speakerId);
  return normalizeValue(matchingProfile?.groupVoiceId);
}

async function recoverMissingPodcastVoice(input: RecoverMissingPodcastVoiceInput) {
  const stored = await getStoredPodcastAsset(input.podcastId);

  if (!stored) {
    return null;
  }

  const target = resolveRecoveryTarget(stored.podcast, {
    missingVoiceId: input.missingVoiceId,
    speakerId: input.speakerId,
  });

  if (!target) {
    return null;
  }

  const currentVoiceId = getTargetVoiceId(stored.podcast, target);

  if (currentVoiceId && currentVoiceId !== target.voiceId) {
    return {
      podcast: stored.podcast,
      voiceId: currentVoiceId,
    };
  }

  const speaker = stored.podcast.speakers.find((entry) => entry.id === target.speakerId);

  if (!speaker) {
    return null;
  }

  const clonedVoice = await clonePodcastSpeakerVoice({
    settings: input.settings,
    podcast: stored.podcast,
    assetPath: stored.uploadedFilePath,
    speakerId: speaker.id,
    speakerName: speaker.name,
  });

  const updatedPodcast = await updateStoredPodcast(input.podcastId, (current) => {
    if (target.kind === "host") {
      return {
        ...current,
        aiHostVoiceId: clonedVoice.voiceId,
        aiHostVoiceName: clonedVoice.voiceName,
        processingError: null,
      };
    }

    return {
      ...current,
      speakerProfiles: current.speakerProfiles.map((profile) =>
        profile.speakerId === target.speakerId
          ? {
              ...profile,
              displayName: speaker.name,
              groupVoiceId: clonedVoice.voiceId,
              groupVoiceName: clonedVoice.voiceName,
              groupVoiceStatus: "ready",
              groupVoiceError: null,
            }
          : profile,
      ),
    };
  });

  return {
    podcast: updatedPodcast ?? stored.podcast,
    voiceId: clonedVoice.voiceId,
  };
}

export async function synthesizePodcastAudioWithRecovery(
  input: SynthesizePodcastAudioWithRecoveryInput,
) {
  const {
    settings,
    podcastId,
    speakerId,
    text,
    cacheKeyParts,
    voiceIdOverride,
    emotion,
    languageCode,
  } = input;

  try {
    return await synthesizeTextWithElevenLabs(settings, {
      text,
      cacheKeyParts,
      voiceIdOverride,
      emotion,
      languageCode,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const missingVoiceId = normalizeValue(voiceIdOverride);

    if (!missingVoiceId || !isElevenLabsVoiceNotFoundErrorMessage(detail)) {
      throw error;
    }

    const recovered = await recoverMissingPodcastVoice({
      settings,
      podcastId,
      missingVoiceId,
      speakerId,
    });

    if (!recovered?.voiceId) {
      throw error;
    }

    return synthesizeTextWithElevenLabs(settings, {
      text,
      cacheKeyParts,
      voiceIdOverride: recovered.voiceId,
      emotion,
      languageCode,
    });
  }
}
