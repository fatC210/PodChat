import type { Podcast } from "@/lib/podchat-data";
import { listStoredPodcasts, updateStoredPodcast } from "@/lib/server/podcast-store";

export function resetPodcastVoicesForElevenLabsKeyChange(podcast: Podcast): Podcast {
  return {
    ...podcast,
    aiHostVoiceId: null,
    aiHostVoiceName: null,
    speakerProfiles: podcast.speakerProfiles.map((profile) => ({
      ...profile,
      groupVoiceId: null,
      groupVoiceName: null,
      groupVoiceStatus: "idle",
      groupVoiceError: null,
    })),
  };
}

export async function resetStoredPodcastVoicesForElevenLabsKeyChange() {
  const podcasts = await listStoredPodcasts();

  for (const podcast of podcasts) {
    await updateStoredPodcast(podcast.id, resetPodcastVoicesForElevenLabsKeyChange);
  }
}
