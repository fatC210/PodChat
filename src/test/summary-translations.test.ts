// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPodcastFromWizard, type IntegrationSettings, type Podcast } from "@/lib/podchat-data";

const { requestOpenAiCompatibleTextMock, updateStoredPodcastMock } = vi.hoisted(() => ({
  requestOpenAiCompatibleTextMock: vi.fn(),
  updateStoredPodcastMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/integrations", () => ({
  hasLlmConfig: (settings: Pick<IntegrationSettings, "llmKey" | "llmUrl" | "llmModel">) =>
    Boolean(settings.llmKey && settings.llmUrl && settings.llmModel),
  requestOpenAiCompatibleText: requestOpenAiCompatibleTextMock,
}));

vi.mock("@/lib/server/podcast-store", () => ({
  updateStoredPodcast: updateStoredPodcastMock,
}));

import { ensureSummaryTranslation } from "@/lib/server/summary-translations";

describe("ensureSummaryTranslation", () => {
  let podcast: Podcast;
  let settings: IntegrationSettings;

  beforeEach(() => {
    vi.clearAllMocks();

    podcast = {
      ...buildPodcastFromWizard({
        title: "Translated Summary Test",
        type: "solo",
        referenceCount: 1,
        sourceFileName: "summary.mp3",
        sourceFileSizeMb: 4.2,
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
          translation: "你好，世界",
        },
      ],
      summaries: [
        {
          duration: 3,
          emotion: "reflective",
          text: "A clear spoken summary.",
          translations: {
            zh: "一段清晰的中文摘要。",
          },
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

  it("returns a cached translation without calling the LLM", async () => {
    const result = await ensureSummaryTranslation({
      podcast,
      duration: 3,
      targetLang: "zh",
      settings,
    });

    expect(result.text).toBe("一段清晰的中文摘要。");
    expect(requestOpenAiCompatibleTextMock).not.toHaveBeenCalled();
    expect(updateStoredPodcastMock).not.toHaveBeenCalled();
  });

  it("requests and stores a new translation when the cache is empty", async () => {
    requestOpenAiCompatibleTextMock.mockResolvedValue("Un resumen claro en español.");

    const result = await ensureSummaryTranslation({
      podcast,
      duration: 3,
      targetLang: "es",
      settings,
    });

    expect(result.text).toBe("Un resumen claro en español.");
    expect(requestOpenAiCompatibleTextMock).toHaveBeenCalledOnce();
    expect(updateStoredPodcastMock).toHaveBeenCalledOnce();
    expect(podcast.summaries[0]?.translations).toEqual({
      zh: "一段清晰的中文摘要。",
      es: "Un resumen claro en español.",
    });
  });
});
