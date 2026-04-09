// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mkdirMock, statMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  statMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("node:fs/promises", () => ({
  mkdir: mkdirMock,
  readFile: vi.fn(),
  stat: statMock,
  writeFile: writeFileMock,
}));

import {
  isElevenLabsVoiceNotFoundErrorMessage,
  synthesizeTextWithElevenLabs,
} from "@/lib/server/elevenlabs";

describe("synthesizeTextWithElevenLabs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mkdirMock.mockResolvedValue(undefined);
    statMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    writeFileMock.mockResolvedValue(undefined);
  });

  it("passes through a detected Chinese language code for chat synthesis", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
        },
      }),
    );

    await synthesizeTextWithElevenLabs(
      { elevenlabs: "test-key" },
      {
        text: "你好，很高兴加入这场对话。",
        cacheKeyParts: ["chat-audio", "podcast-1", "speaker-2"],
        voiceIdOverride: "voice-2",
        emotion: "lighthearted",
      },
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = JSON.parse(String(requestInit?.body ?? "{}")) as {
      language_code?: string;
      model_id?: string;
      text?: string;
    };

    expect(requestBody).toMatchObject({
      language_code: "zh",
      model_id: "eleven_multilingual_v2",
      text: "你好，很高兴加入这场对话。",
    });
  });

  it("surfaces a reclone hint when the stored voice is missing for the current API key", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "voice_not_found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(
      synthesizeTextWithElevenLabs(
        { elevenlabs: "test-key" },
        {
          text: "Hello there",
          cacheKeyParts: ["summary-audio", "podcast-1"],
          voiceIdOverride: "missing-voice",
        },
      ),
    ).rejects.toThrow(/Reclone the AI host voice and any affected speaker voices/i);
  });

  it("recognizes the wrapped missing-voice message used after upstream normalization", () => {
    expect(
      isElevenLabsVoiceNotFoundErrorMessage(
        "The ElevenLabs voice cWO3SWOrlnvVaWPeCMMO is not available for the current API key.",
      ),
    ).toBe(true);
  });
});
