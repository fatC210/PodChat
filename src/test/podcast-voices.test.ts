// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

const {
  deleteElevenLabsVoiceMock,
  getElevenLabsSubscriptionMock,
  listElevenLabsVoicesMock,
  listStoredPodcastsMock,
} = vi.hoisted(() => ({
  deleteElevenLabsVoiceMock: vi.fn(),
  getElevenLabsSubscriptionMock: vi.fn(),
  listElevenLabsVoicesMock: vi.fn(),
  listStoredPodcastsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/elevenlabs", () => ({
  deleteElevenLabsVoice: deleteElevenLabsVoiceMock,
  getElevenLabsSubscription: getElevenLabsSubscriptionMock,
  listElevenLabsVoices: listElevenLabsVoicesMock,
}));

vi.mock("@/lib/server/podcast-store", () => ({
  listStoredPodcasts: listStoredPodcastsMock,
}));

import {
  buildElevenLabsVoiceLimitMessage,
  ensurePodChatVoiceCapacity,
  getReusableGroupSpeakerVoice,
} from "@/lib/server/podcast-voices";

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Voice Capacity Podcast",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "episode.mp3",
      sourceFileSizeMb: 5.4,
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
    detectedSpeakerCount: 2,
    speakers: [
      { id: "speaker-1", name: "Host", pct: 55, preview: "Host line", duration: "00:10" },
      { id: "speaker-2", name: "Guest", pct: 45, preview: "Guest line", duration: "00:08" },
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
        groupVoiceId: null,
        groupVoiceName: null,
        groupVoiceStatus: "idle",
        groupVoiceError: null,
      },
    ],
  };
}

describe("ensurePodChatVoiceCapacity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reclaims unused PodChat cloned voices before new cloning work", async () => {
    listStoredPodcastsMock.mockResolvedValue([
      {
        ...buildReadyPodcast(),
        aiHostVoiceId: "keep-voice",
      },
    ]);
    getElevenLabsSubscriptionMock
      .mockResolvedValueOnce({ voiceSlotsUsed: 10, voiceLimit: 10 })
      .mockResolvedValueOnce({ voiceSlotsUsed: 9, voiceLimit: 10 });
    listElevenLabsVoicesMock.mockResolvedValue([
      { voice_id: "keep-voice", name: "PodChat Active Host", category: "cloned" },
      { voice_id: "stale-voice", name: "PodChat Old Episode", category: "cloned" },
      { voice_id: "foreign-voice", name: "User Custom Voice", category: "cloned" },
      { voice_id: "premade-voice", name: "George", category: "premade" },
    ]);

    await ensurePodChatVoiceCapacity({ elevenlabs: "test-key" });

    expect(deleteElevenLabsVoiceMock).toHaveBeenCalledTimes(1);
    expect(deleteElevenLabsVoiceMock).toHaveBeenCalledWith({ elevenlabs: "test-key" }, "stale-voice");
  });

  it("throws a descriptive error when no free voice slots remain", async () => {
    listStoredPodcastsMock.mockResolvedValue([buildReadyPodcast()]);
    getElevenLabsSubscriptionMock.mockResolvedValue({ voiceSlotsUsed: 10, voiceLimit: 10 });
    listElevenLabsVoicesMock.mockResolvedValue([
      { voice_id: "host-voice", name: "PodChat Active Host", category: "cloned" },
    ]);

    await expect(ensurePodChatVoiceCapacity({ elevenlabs: "test-key" })).rejects.toThrow(
      "ElevenLabs voice slots are full (10/10).",
    );
    expect(deleteElevenLabsVoiceMock).not.toHaveBeenCalled();
  });
});

describe("getReusableGroupSpeakerVoice", () => {
  it("reuses the existing AI host voice for the host speaker", () => {
    expect(getReusableGroupSpeakerVoice(buildReadyPodcast(), "speaker-1")).toEqual({
      voiceId: "host-voice",
      voiceName: "Host Voice",
    });
  });

  it("does not reuse the host voice for other group speakers", () => {
    expect(getReusableGroupSpeakerVoice(buildReadyPodcast(), "speaker-2")).toBeNull();
  });
});

describe("buildElevenLabsVoiceLimitMessage", () => {
  it("mentions reclaimed voices when cleanup still leaves the account full", () => {
    expect(
      buildElevenLabsVoiceLimitMessage({
        used: 10,
        limit: 10,
        reclaimedVoiceCount: 2,
      }),
    ).toContain("already cleaned up 2 unused cloned voices");
  });
});
