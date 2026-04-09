// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/settings/route";

describe("PATCH /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("echoes normalized settings without persisting them server-side", async () => {
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
    await expect(response.json()).resolves.toEqual({
      settings: {
        elevenlabs: "new-key",
        elevenlabsVoiceId: "voice-1",
        elevenlabsAgentId: "agent-should-be-ignored",
        firecrawl: "crawl-key",
        llmKey: "llm-key",
        llmUrl: "https://example.com/v1",
        llmModel: "gpt-test",
      },
    });
  });
});
