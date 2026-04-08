import "server-only";

import type { IntegrationSettings, Podcast } from "@/lib/podchat-data";
import { normalizeValue } from "@/lib/server/integrations";
import {
  deleteElevenLabsVoice,
  getElevenLabsSubscription,
  listElevenLabsVoices,
} from "@/lib/server/elevenlabs";
import { listStoredPodcasts } from "@/lib/server/podcast-store";

function toVoiceIdSet(voiceIds?: Iterable<string | null | undefined>) {
  const normalized = new Set<string>();

  for (const voiceId of voiceIds ?? []) {
    const nextVoiceId = normalizeValue(voiceId);

    if (nextVoiceId) {
      normalized.add(nextVoiceId);
    }
  }

  return normalized;
}

export function collectPodcastVoiceIds(podcast: Podcast) {
  return toVoiceIdSet([
    podcast.aiHostVoiceId,
    ...podcast.speakerProfiles.map((profile) => profile.groupVoiceId),
  ]);
}

function collectReferencedPodcastVoiceIds(podcasts: Podcast[]) {
  const referencedVoiceIds = new Set<string>();

  podcasts.forEach((podcast) => {
    collectPodcastVoiceIds(podcast).forEach((voiceId) => {
      referencedVoiceIds.add(voiceId);
    });
  });

  return referencedVoiceIds;
}

function isManagedPodChatVoice(voice: { voice_id?: string; name?: string; category?: string }) {
  return voice.category === "cloned" && normalizeValue(voice.name).startsWith("PodChat ");
}

export function buildElevenLabsVoiceLimitMessage(input: {
  used?: number | null;
  limit?: number | null;
  reclaimedVoiceCount?: number;
}) {
  const used = typeof input.used === "number" ? input.used : null;
  const limit = typeof input.limit === "number" ? input.limit : null;
  const reclaimedVoiceCount = input.reclaimedVoiceCount ?? 0;
  const usageLabel = used !== null && limit !== null ? `${used}/${limit}` : "the current plan";
  const reclaimedContext =
    reclaimedVoiceCount > 0
      ? ` PodChat already cleaned up ${reclaimedVoiceCount} unused cloned voice${reclaimedVoiceCount === 1 ? "" : "s"}, but no free slots remain.`
      : "";

  return `ElevenLabs voice slots are full (${usageLabel}).${reclaimedContext} Delete an older podcast or remove unused cloned voices before cloning more speaker voices.`;
}

export function getReusableGroupSpeakerVoice(podcast: Podcast, speakerId: string) {
  const normalizedSpeakerId = normalizeValue(speakerId);

  if (!normalizedSpeakerId) {
    return null;
  }

  if (normalizedSpeakerId === normalizeValue(podcast.aiHostSpeakerId)) {
    const hostVoiceId = normalizeValue(podcast.aiHostVoiceId);

    if (hostVoiceId) {
      return {
        voiceId: hostVoiceId,
        voiceName: normalizeValue(podcast.aiHostVoiceName) || podcast.aiHost || null,
      };
    }
  }

  return null;
}

export async function reclaimUnusedPodChatVoices(
  settings: Pick<IntegrationSettings, "elevenlabs">,
  options?: {
    preserveVoiceIds?: Iterable<string | null | undefined>;
  },
) {
  const initialSubscription = await getElevenLabsSubscription(settings);
  const voiceLimit = initialSubscription.voiceLimit ?? null;
  const voiceSlotsUsed = initialSubscription.voiceSlotsUsed ?? null;

  if (voiceLimit === null || voiceSlotsUsed === null || voiceSlotsUsed < voiceLimit) {
    return {
      deletedVoiceIds: [] as string[],
      subscription: initialSubscription,
    };
  }

  const storedPodcasts = await listStoredPodcasts();
  const preservedVoiceIds = collectReferencedPodcastVoiceIds(storedPodcasts);
  toVoiceIdSet(options?.preserveVoiceIds).forEach((voiceId) => preservedVoiceIds.add(voiceId));

  const voices = await listElevenLabsVoices(settings);
  const reclaimableVoices = voices.filter(
    (voice) => voice.voice_id && isManagedPodChatVoice(voice) && !preservedVoiceIds.has(voice.voice_id),
  );
  const deletedVoiceIds: string[] = [];

  for (const voice of reclaimableVoices) {
    if (!voice.voice_id) {
      continue;
    }

    try {
      await deleteElevenLabsVoice(settings, voice.voice_id);
      deletedVoiceIds.push(voice.voice_id);
    } catch {
      void 0;
    }
  }

  const subscription = deletedVoiceIds.length > 0
    ? await getElevenLabsSubscription(settings)
    : initialSubscription;

  return {
    deletedVoiceIds,
    subscription,
  };
}

export async function ensurePodChatVoiceCapacity(
  settings: Pick<IntegrationSettings, "elevenlabs">,
  options?: {
    preserveVoiceIds?: Iterable<string | null | undefined>;
  },
) {
  const { deletedVoiceIds, subscription } = await reclaimUnusedPodChatVoices(settings, options);
  const voiceLimit = subscription.voiceLimit ?? null;
  const voiceSlotsUsed = subscription.voiceSlotsUsed ?? null;

  if (voiceLimit !== null && voiceSlotsUsed !== null && voiceSlotsUsed >= voiceLimit) {
    throw new Error(
      buildElevenLabsVoiceLimitMessage({
        used: voiceSlotsUsed,
        limit: voiceLimit,
        reclaimedVoiceCount: deletedVoiceIds.length,
      }),
    );
  }
}

export async function deletePodcastVoices(
  settings: Pick<IntegrationSettings, "elevenlabs">,
  podcast: Podcast,
) {
  const voiceIds = collectPodcastVoiceIds(podcast);

  for (const voiceId of voiceIds) {
    try {
      await deleteElevenLabsVoice(settings, voiceId);
    } catch {
      void 0;
    }
  }
}
