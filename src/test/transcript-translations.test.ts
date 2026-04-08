// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPodcastFromWizard, type IntegrationSettings, type Podcast } from "@/lib/podchat-data";

const { requestOpenAiCompatibleJsonMock, updateStoredPodcastMock } = vi.hoisted(() => ({
  requestOpenAiCompatibleJsonMock: vi.fn(),
  updateStoredPodcastMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/integrations", () => ({
  hasLlmConfig: (settings: Pick<IntegrationSettings, "llmKey" | "llmUrl" | "llmModel">) =>
    Boolean(settings.llmKey && settings.llmUrl && settings.llmModel),
  requestOpenAiCompatibleJson: requestOpenAiCompatibleJsonMock,
}));

vi.mock("@/lib/server/podcast-store", () => ({
  updateStoredPodcast: updateStoredPodcastMock,
}));

import { ensureTranscriptTranslation } from "@/lib/server/transcript-translations";

describe("ensureTranscriptTranslation", () => {
  let podcast: Podcast;
  let settings: IntegrationSettings;

  beforeEach(() => {
    vi.clearAllMocks();

    podcast = {
      ...buildPodcastFromWizard({
        title: "Translated Transcript Test",
        type: "solo",
        referenceCount: 1,
        sourceFileName: "transcript.mp3",
        sourceFileSizeMb: 5.4,
        personaPresetId: "analytical",
        personaLocale: "en",
        customPersonality: "",
        customCatchphrases: "",
        customAnswerStyle: "",
      }),
      status: "ready",
      aiHost: "Speaker 1",
      transcript: [
        {
          id: "line-1",
          speakerId: "speaker-1",
          speaker: "Speaker 1",
          color: "text-accent",
          time: "00:00",
          endTime: "00:05",
          text: "Hello world",
          translation: "Hello world",
        },
      ],
      summaries: [
        {
          duration: 3,
          emotion: "reflective",
          text: "A clear spoken summary.",
        },
      ],
    };

    settings = {
      elevenlabs: "",
      elevenlabsVoiceId: "",
      elevenlabsAgentId: "",
      firecrawl: "",
      llmKey: "test-llm-key",
      llmUrl: "https://example.com/v1",
      llmModel: "test-model",
    };

    updateStoredPodcastMock.mockImplementation(async (_id: string, updater: (currentPodcast: Podcast) => Podcast) => {
      podcast = updater(podcast);
      return podcast;
    });
  });

  it("returns a cached transcript translation without calling the LLM", async () => {
    podcast.transcript[0] = {
      ...podcast.transcript[0],
      translations: {
        es: "Hola mundo",
      },
    };

    const result = await ensureTranscriptTranslation({
      podcast,
      targetLang: "es",
      settings,
    });

    expect(result.translations).toEqual({
      "line-1": "Hola mundo",
    });
    expect(requestOpenAiCompatibleJsonMock).not.toHaveBeenCalled();
    expect(updateStoredPodcastMock).not.toHaveBeenCalled();
  });

  it("requests and stores a new transcript translation when the cache is empty", async () => {
    requestOpenAiCompatibleJsonMock.mockResolvedValue({
      translations: {
        "line-1": "你好，世界",
      },
    });

    const result = await ensureTranscriptTranslation({
      podcast,
      targetLang: "zh",
      settings,
    });

    expect(result.translations).toEqual({
      "line-1": "你好，世界",
    });
    expect(requestOpenAiCompatibleJsonMock).toHaveBeenCalledOnce();
    expect(updateStoredPodcastMock).toHaveBeenCalledOnce();
    expect(podcast.transcript[0]?.translations).toEqual({
      zh: "你好，世界",
    });
    expect(podcast.transcript[0]?.translation).toBe("你好，世界");
  });
});
