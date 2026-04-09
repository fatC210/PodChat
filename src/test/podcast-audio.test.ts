// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

const {
  clonePodcastSpeakerVoiceMock,
  getStoredPodcastAssetMock,
  isElevenLabsVoiceNotFoundErrorMessageMock,
  synthesizeTextWithElevenLabsMock,
  updateStoredPodcastMock,
} = vi.hoisted(() => ({
  clonePodcastSpeakerVoiceMock: vi.fn(),
  getStoredPodcastAssetMock: vi.fn(),
  isElevenLabsVoiceNotFoundErrorMessageMock: vi.fn(),
  synthesizeTextWithElevenLabsMock: vi.fn(),
  updateStoredPodcastMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/elevenlabs", () => ({
  isElevenLabsVoiceNotFoundErrorMessage: isElevenLabsVoiceNotFoundErrorMessageMock,
  synthesizeTextWithElevenLabs: synthesizeTextWithElevenLabsMock,
}));

vi.mock("@/lib/server/podcast-store", () => ({
  getStoredPodcastAsset: getStoredPodcastAssetMock,
  updateStoredPodcast: updateStoredPodcastMock,
}));

vi.mock("@/lib/server/voice-cloning", () => ({
  clonePodcastSpeakerVoice: clonePodcastSpeakerVoiceMock,
}));

import { synthesizePodcastAudioWithRecovery } from "@/lib/server/podcast-audio";

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Recovery Test Podcast",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "episode.mp3",
      sourceFileSizeMb: 8.4,
      personaPresetId: "professional",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    }),
    status: "ready",
    aiHost: "Host",
    aiHostSpeakerId: "speaker-1",
    aiHostVoiceId: "missing-host",
    aiHostVoiceName: "Old Host Voice",
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
        groupVoiceId: null,
        groupVoiceName: null,
        groupVoiceStatus: "idle",
        groupVoiceError: null,
      },
      {
        speakerId: "speaker-2",
        displayName: "Guest",
        handle: "@guest",
        positioning: "Guest positioning",
        perspective: "Guest perspective",
        speakingStyle: "Guest style",
        grounding: ["Guest line"],
        groupVoiceId: "missing-group",
        groupVoiceName: "Old Guest Voice",
        groupVoiceStatus: "ready",
        groupVoiceError: null,
      },
    ],
  };
}

describe("synthesizePodcastAudioWithRecovery", () => {
  let currentPodcast: Podcast;

  beforeEach(() => {
    vi.clearAllMocks();
    currentPodcast = buildReadyPodcast();
    isElevenLabsVoiceNotFoundErrorMessageMock.mockImplementation((detail: string) => detail.includes("not available"));
    getStoredPodcastAssetMock.mockImplementation(async () => ({
      podcast: currentPodcast,
      uploadedFilePath: "D:\\code\\PodChat\\.podchat\\uploads\\episode.mp3",
      sourceFileName: "episode.mp3",
    }));
    updateStoredPodcastMock.mockImplementation(async (_id: string, updater: (podcast: Podcast) => Podcast) => {
      currentPodcast = updater(currentPodcast);
      return currentPodcast;
    });
  });

  it("reclones the host voice and retries synthesis when the stored host voice is missing", async () => {
    synthesizeTextWithElevenLabsMock
      .mockRejectedValueOnce(
        new Error("The ElevenLabs voice missing-host is not available for the current API key."),
      )
      .mockResolvedValueOnce({
        audioPath: "D:\\code\\PodChat\\.podchat\\generated\\host.mp3",
        voiceId: "fresh-host",
        contentType: "audio/mpeg",
      });
    clonePodcastSpeakerVoiceMock.mockResolvedValue({
      voiceId: "fresh-host",
      voiceName: "Fresh Host Voice",
    });

    const result = await synthesizePodcastAudioWithRecovery({
      settings: {
        elevenlabs: "test-key",
        elevenlabsVoiceId: "",
      },
      podcastId: currentPodcast.id,
      text: "summary text",
      cacheKeyParts: ["summary-audio", currentPodcast.id, "1"],
      voiceIdOverride: "missing-host",
    });

    expect(result.voiceId).toBe("fresh-host");
    expect(clonePodcastSpeakerVoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        speakerId: "speaker-1",
        speakerName: "Host",
      }),
    );
    expect(synthesizeTextWithElevenLabsMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({
        voiceIdOverride: "fresh-host",
      }),
    );
    expect(currentPodcast.aiHostVoiceId).toBe("fresh-host");
    expect(currentPodcast.aiHostVoiceName).toBe("Fresh Host Voice");
  });

  it("reclones the selected group speaker voice and retries synthesis", async () => {
    synthesizeTextWithElevenLabsMock
      .mockRejectedValueOnce(
        new Error("The ElevenLabs voice missing-group is not available for the current API key."),
      )
      .mockResolvedValueOnce({
        audioPath: "D:\\code\\PodChat\\.podchat\\generated\\group.mp3",
        voiceId: "fresh-group",
        contentType: "audio/mpeg",
      });
    clonePodcastSpeakerVoiceMock.mockResolvedValue({
      voiceId: "fresh-group",
      voiceName: "Fresh Guest Voice",
    });

    const result = await synthesizePodcastAudioWithRecovery({
      settings: {
        elevenlabs: "test-key",
        elevenlabsVoiceId: "",
      },
      podcastId: currentPodcast.id,
      speakerId: "speaker-2",
      text: "group reply",
      cacheKeyParts: ["chat-audio", currentPodcast.id, "speaker-2"],
      voiceIdOverride: "missing-group",
    });

    expect(result.voiceId).toBe("fresh-group");
    expect(clonePodcastSpeakerVoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        speakerId: "speaker-2",
        speakerName: "Guest",
      }),
    );
    expect(synthesizeTextWithElevenLabsMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({
        voiceIdOverride: "fresh-group",
      }),
    );
    expect(currentPodcast.speakerProfiles[1]?.groupVoiceId).toBe("fresh-group");
    expect(currentPodcast.speakerProfiles[1]?.groupVoiceName).toBe("Fresh Guest Voice");
    expect(currentPodcast.speakerProfiles[1]?.groupVoiceStatus).toBe("ready");
  });
});
