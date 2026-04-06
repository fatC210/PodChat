import { describe, expect, it } from "vitest";
import {
  getTranscriptDurationSeconds,
  normalizeDisplayDuration,
  resolveTranscriptionDurationSeconds,
} from "@/lib/transcript-duration";

describe("resolveTranscriptionDurationSeconds", () => {
  it("uses the last word timestamp when precise timestamps are available", () => {
    const durationSeconds = resolveTranscriptionDurationSeconds(
      [
        { startSeconds: 0.4, endSeconds: 5.2 },
        { startSeconds: 5.3, endSeconds: 1211.1 },
      ],
      true,
    );

    expect(durationSeconds).toBe(1211.1);
  });

  it("falls back to synthetic 8-second chunks when only plain text segmentation exists", () => {
    const durationSeconds = resolveTranscriptionDurationSeconds(
      [
        { startSeconds: 0, endSeconds: 7 },
        { startSeconds: 8, endSeconds: 15 },
        { startSeconds: 16, endSeconds: 23 },
      ],
      false,
    );

    expect(durationSeconds).toBe(24);
  });
});

describe("normalizeDisplayDuration", () => {
  it("derives a display duration from transcript end times when stored data is inflated", () => {
    const transcript = [
      { time: "0:04", endTime: "0:08" },
      { time: "19:57", endTime: "20:09" },
    ];

    expect(getTranscriptDurationSeconds(transcript)).toBe(1209);
    expect(normalizeDisplayDuration("36:00", transcript)).toBe("20:09");
  });
});
