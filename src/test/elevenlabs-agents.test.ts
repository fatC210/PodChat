// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { readStoredIntegrationSettingsMock, writeStoredIntegrationSettingsMock } = vi.hoisted(() => ({
  readStoredIntegrationSettingsMock: vi.fn(),
  writeStoredIntegrationSettingsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/settings-store", () => ({
  readStoredIntegrationSettings: readStoredIntegrationSettingsMock,
  writeStoredIntegrationSettings: writeStoredIntegrationSettingsMock,
}));

import { ensureStoredBaseAgent } from "@/lib/server/elevenlabs-agents";

describe("ensureStoredBaseAgent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    readStoredIntegrationSettingsMock.mockResolvedValue({
      elevenlabs: "new-key",
      elevenlabsVoiceId: "",
      elevenlabsAgentId: "stale-agent",
      firecrawl: "",
      llmKey: "",
      llmUrl: "",
      llmModel: "",
    });
    writeStoredIntegrationSettingsMock.mockImplementation(async (settings) => settings);
  });

  it("recreates the stored base agent when the saved agent belongs to a different account", async () => {
    const fetchMock = vi.spyOn(global, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "agent_not_found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agent_id: "agent_fresh" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            platform_settings: {
              overrides: {
                conversation_config_override: {
                  agent: {
                    first_message: true,
                    language: true,
                    prompt: {
                      prompt: true,
                    },
                  },
                  tts: {
                    voice_id: true,
                    stability: true,
                    speed: true,
                    similarity_boost: true,
                  },
                  conversation: {
                    text_only: true,
                  },
                },
              },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    const result = await ensureStoredBaseAgent();

    expect(result.elevenlabsAgentId).toBe("agent_fresh");
    expect(writeStoredIntegrationSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        elevenlabsAgentId: "agent_fresh",
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
