import { describe, expect, it } from "vitest";
import { isIgnorableUserMessageText, normalizeFloatingChatMessage } from "@/lib/floating-chat";

describe("isIgnorableUserMessageText", () => {
  it("filters punctuation-only placeholders", () => {
    expect(isIgnorableUserMessageText("...")).toBe(true);
    expect(isIgnorableUserMessageText("\u2026")).toBe(true);
    expect(isIgnorableUserMessageText("\u3002\u3002")).toBe(true);
  });

  it("keeps real user text sendable", () => {
    expect(isIgnorableUserMessageText("hello")).toBe(false);
    expect(isIgnorableUserMessageText("\u4f60\u597d")).toBe(false);
  });
});

describe("normalizeFloatingChatMessage", () => {
  it("ignores tentative user transcripts", () => {
    expect(
      normalizeFloatingChatMessage({
        type: "tentative_user_transcript",
        tentative_user_transcription_event: {
          user_transcript: "...",
          event_id: 9,
        },
      }),
    ).toBeNull();
  });

  it("normalizes final user transcripts", () => {
    expect(
      normalizeFloatingChatMessage({
        type: "user_transcript",
        user_transcription_event: {
          user_transcript: "Need the takeaway",
          event_id: 12,
        },
      }),
    ).toEqual({
      id: "user-12",
      role: "user",
      text: "Need the takeaway",
    });
  });

  it("normalizes corrected agent responses onto the same event id", () => {
    expect(
      normalizeFloatingChatMessage({
        type: "agent_response_correction",
        agent_response_correction_event: {
          original_agent_response: "Short answer",
          corrected_agent_response: "Longer and better answer",
          event_id: 34,
        },
      }),
    ).toEqual({
      id: "ai-34",
      role: "ai",
      text: "Longer and better answer",
    });
  });

  it("drops generic user payloads that are only ellipses", () => {
    expect(
      normalizeFloatingChatMessage({
        role: "user",
        message: "...",
      }),
    ).toBeNull();
  });
});
