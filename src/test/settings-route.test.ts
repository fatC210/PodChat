// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enqueueConfiguringPodcastsMock,
  readStoredIntegrationSettingsMock,
  resetStoredPodcastVoicesForElevenLabsKeyChangeMock,
  writeStoredIntegrationSettingsMock,
} = vi.hoisted(() => ({
  enqueueConfiguringPodcastsMock: vi.fn(),
  readStoredIntegrationSettingsMock: vi.fn(),
  resetStoredPodcastVoicesForElevenLabsKeyChangeMock: vi.fn(),
  writeStoredIntegrationSettingsMock: vi.fn(),
}));

vi.mock("@/lib/server/podcast-processing", () => ({
  enqueueConfiguringPodcasts: enqueueConfiguringPodcastsMock,
}));

vi.mock("@/lib/server/podcast-voice-reset", () => ({
  resetStoredPodcastVoicesForElevenLabsKeyChange: resetStoredPodcastVoicesForElevenLabsKeyChangeMock,
}));

vi.mock("@/lib/server/settings-store", () => ({
  readStoredIntegrationSettings: readStoredIntegrationSettingsMock,
  writeStoredIntegrationSettings: writeStoredIntegrationSettingsMock,
}));

import { PATCH } from "@/app/api/settings/route";

describe("PATCH /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readStoredIntegrationSettingsMock.mockResolvedValue({
      elevenlabs: "old-key",
      elevenlabsVoiceId: "voice-1",
      elevenlabsAgentId: "agent-1",
      firecrawl: "crawl-key",
      llmKey: "llm-key",
      llmUrl: "https://example.com/v1",
      llmModel: "gpt-test",
    });
    writeStoredIntegrationSettingsMock.mockImplementation(async (settings) => settings);
    enqueueConfiguringPodcastsMock.mockResolvedValue(undefined);
    resetStoredPodcastVoicesForElevenLabsKeyChangeMock.mockResolvedValue(undefined);
  });

  it("clears the stored agent and podcast voice references when the ElevenLabs key changes", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: {
            elevenlabs: "new-key",
            elevenlabsVoiceId: "voice-1",
            elevenlabsAgentId: "agent-should-be-ignored",
            firecrawl: "crawl-key",
            llmKey: "llm-key",
            llmUrl: "https://example.com/v1",
            llmModel: "gpt-test",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(writeStoredIntegrationSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        elevenlabs: "new-key",
        elevenlabsAgentId: "",
      }),
    );
    expect(resetStoredPodcastVoicesForElevenLabsKeyChangeMock).toHaveBeenCalledTimes(1);
    expect(enqueueConfiguringPodcastsMock).toHaveBeenCalledTimes(1);
  });

  it("keeps existing voice references when the ElevenLabs key is unchanged", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: {
            elevenlabs: "old-key",
            elevenlabsVoiceId: "voice-2",
            elevenlabsAgentId: "agent-2",
            firecrawl: "crawl-key",
            llmKey: "llm-key",
            llmUrl: "https://example.com/v1",
            llmModel: "gpt-test",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(writeStoredIntegrationSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        elevenlabs: "old-key",
        elevenlabsAgentId: "agent-2",
      }),
    );
    expect(resetStoredPodcastVoicesForElevenLabsKeyChangeMock).not.toHaveBeenCalled();
    expect(enqueueConfiguringPodcastsMock).toHaveBeenCalledTimes(1);
  });
});
