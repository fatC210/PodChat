import { describe, expect, it, vi } from "vitest";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/podcast-store", () => ({
  listStoredPodcasts: vi.fn(),
  updateStoredPodcast: vi.fn(),
}));

import { resetPodcastVoicesForElevenLabsKeyChange } from "@/lib/server/podcast-voice-reset";

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Voice Reset Podcast",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "episode.mp3",
      sourceFileSizeMb: 12.5,
      personaPresetId: "professional",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    }),
    status: "ready",
    aiHost: "Host",
    aiHostSpeakerId: "speaker-1",
    aiHostVoiceId: "host-voice",
    aiHostVoiceName: "Host Voice",
    speakers: [
      { id: "speaker-1", name: "Host", pct: 60, preview: "Host line", duration: "00:30" },
      { id: "speaker-2", name: "Guest", pct: 40, preview: "Guest line", duration: "00:20" },
    ],
    speakerProfiles: [
      {
        speakerId: "speaker-1",
        displayName: "Host",
        handle: "@host",
        positioning: "Host positioning",
        perspective: "Host perspective",
        speakingStyle: "Host style",
        grounding: ["Host line"],
        groupVoiceId: "group-host",
        groupVoiceName: "Host Group Voice",
        groupVoiceStatus: "ready",
        groupVoiceError: "old error",
      },
      {
        speakerId: "speaker-2",
        displayName: "Guest",
        handle: "@guest",
        positioning: "Guest positioning",
        perspective: "Guest perspective",
        speakingStyle: "Guest style",
        grounding: ["Guest line"],
        groupVoiceId: "group-guest",
        groupVoiceName: "Guest Group Voice",
        groupVoiceStatus: "failed",
        groupVoiceError: "voice missing",
      },
    ],
  };
}

describe("resetPodcastVoicesForElevenLabsKeyChange", () => {
  it("clears stored cloned voice references so the next key can prepare fresh voices", () => {
    const resetPodcast = resetPodcastVoicesForElevenLabsKeyChange(buildReadyPodcast());

    expect(resetPodcast.aiHostSpeakerId).toBe("speaker-1");
    expect(resetPodcast.aiHostVoiceId).toBeNull();
    expect(resetPodcast.aiHostVoiceName).toBeNull();
    expect(resetPodcast.speakerProfiles).toEqual([
      expect.objectContaining({
        speakerId: "speaker-1",
        groupVoiceId: null,
        groupVoiceName: null,
        groupVoiceStatus: "idle",
        groupVoiceError: null,
      }),
      expect.objectContaining({
        speakerId: "speaker-2",
        groupVoiceId: null,
        groupVoiceName: null,
        groupVoiceStatus: "idle",
        groupVoiceError: null,
      }),
    ]);
  });
});
