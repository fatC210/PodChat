// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

const {
  clonePodcastSpeakerVoiceMock,
  delayMock,
  generateLivePodcastOutputMock,
  getStoredPodcastAssetMock,
  listStoredPodcastsMock,
  updateStoredPodcastMock,
} = vi.hoisted(() => ({
  clonePodcastSpeakerVoiceMock: vi.fn(),
  delayMock: vi.fn().mockResolvedValue(undefined),
  generateLivePodcastOutputMock: vi.fn(),
  getStoredPodcastAssetMock: vi.fn(),
  listStoredPodcastsMock: vi.fn(),
  updateStoredPodcastMock: vi.fn(),
}));

vi.mock("node:timers/promises", () => ({
  setTimeout: delayMock,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/live-podcast-processing", () => ({
  generateLivePodcastOutput: generateLivePodcastOutputMock,
}));

vi.mock("@/lib/server/podcast-store", () => ({
  getStoredPodcastAsset: getStoredPodcastAssetMock,
  listStoredPodcasts: listStoredPodcastsMock,
  updateStoredPodcast: updateStoredPodcastMock,
}));

vi.mock("@/lib/server/voice-cloning", () => ({
  clonePodcastSpeakerVoice: clonePodcastSpeakerVoiceMock,
}));

import {
  enqueuePodcastProcessing,
  setPodcastProcessingIntegrationSettings,
} from "@/lib/server/podcast-processing";

describe("enqueuePodcastProcessing", () => {
  let currentPodcast: Podcast;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { __podchatProcessorRuntime?: unknown }).__podchatProcessorRuntime;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    currentPodcast = buildPodcastFromWizard({
      title: "Processing Regression Test",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "episode.mp3",
      sourceFileSizeMb: 18.2,
      personaPresetId: "analytical",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    });

    getStoredPodcastAssetMock.mockResolvedValue({
      podcast: currentPodcast,
      uploadedFilePath: "D:\\code\\PodChat\\.podchat\\uploads\\episode.mp3",
      sourceFileName: "episode.mp3",
    });
    listStoredPodcastsMock.mockResolvedValue([]);
    updateStoredPodcastMock.mockImplementation(async (_id: string, updater: (podcast: Podcast) => Podcast) => {
      currentPodcast = updater(currentPodcast);
      return currentPodcast;
    });
    generateLivePodcastOutputMock.mockResolvedValue({
      duration: "12:34",
      topic: "AI audio workflows",
      aiHost: "Speaker 1",
      aiHostSpeakerId: "speaker-1",
      aiHostVoiceId: null,
      aiHostVoiceName: null,
      guestName: "Speaker 2",
      transcript: [
        {
          id: "line-1",
          speakerId: "speaker-1",
          speaker: "Speaker 1",
          color: "text-accent",
          time: "0:00",
          endTime: "0:05",
          text: "Hello from the host.",
          translation: "Hello from the host.",
        },
      ],
      chapters: [{ id: "chapter-1", title: "Intro", time: "0:00" }],
      summaries: [{ duration: 1, emotion: "reflective", text: "Short summary." }],
      scriptChunks: [{ id: 1, text: "Hello from the host." }],
      crawledPages: [],
      speakers: [
        { id: "speaker-1", name: "Speaker 1", pct: 70, preview: "Hello from the host.", duration: "00:30" },
        { id: "speaker-2", name: "Speaker 2", pct: 30, preview: "Reply from the guest.", duration: "00:15" },
      ],
    });
  });

  it("marks the podcast ready even when voice cloning fails", async () => {
    clonePodcastSpeakerVoiceMock.mockRejectedValue(new Error("Failed to reach ElevenLabs voice cloning API."));
    setPodcastProcessingIntegrationSettings(currentPodcast.id, {
      elevenlabs: "test-elevenlabs-key",
      elevenlabsVoiceId: "",
      elevenlabsAgentId: "",
      firecrawl: "test-firecrawl-key",
      llmKey: "test-llm-key",
      llmUrl: "https://example.com/v1",
      llmModel: "test-model",
    });

    enqueuePodcastProcessing(currentPodcast.id);

    await vi.waitFor(() => {
      expect(currentPodcast.status).toBe("ready");
    });

    expect(currentPodcast.workflowStep).toBeUndefined();
    expect(currentPodcast.processingProgressPercent).toBe(100);
    expect(currentPodcast.processingError).toBeNull();
    expect(currentPodcast.aiHost).toBe("Speaker 1");
    expect(currentPodcast.aiHostSpeakerId).toBe("speaker-1");
    expect(currentPodcast.aiHostVoiceId).toBeNull();
    expect(currentPodcast.aiHostVoiceName).toBeNull();
    expect(currentPodcast.transcript).toHaveLength(1);
    expect(currentPodcast.summaries).toHaveLength(1);
    expect(clonePodcastSpeakerVoiceMock).toHaveBeenCalledOnce();
  });

  it("repairs a legacy runtime object before storing integration settings", () => {
    const scopedGlobal = globalThis as typeof globalThis & {
      __podchatProcessorRuntime?: unknown;
    };

    scopedGlobal.__podchatProcessorRuntime = {
      activePodcastIds: new Set<string>(),
      resumedPendingPodcasts: false,
    };

    expect(() =>
      setPodcastProcessingIntegrationSettings(currentPodcast.id, {
        elevenlabs: "test-elevenlabs-key",
        elevenlabsVoiceId: "",
        elevenlabsAgentId: "",
        firecrawl: "test-firecrawl-key",
        llmKey: "test-llm-key",
        llmUrl: "https://example.com/v1",
        llmModel: "test-model",
      }),
    ).not.toThrow();

    const repairedRuntime = scopedGlobal.__podchatProcessorRuntime as {
      integrationSettingsByPodcastId?: Map<string, unknown>;
    };

    expect(repairedRuntime.integrationSettingsByPodcastId).toBeInstanceOf(Map);
    expect(repairedRuntime.integrationSettingsByPodcastId?.has(currentPodcast.id)).toBe(true);
  });
});
