import { describe, expect, it } from "vitest";
import { isMediaPlaybackInterruption } from "@/lib/utils";

describe("isMediaPlaybackInterruption", () => {
  it("treats a pause-interrupted play request as expected", () => {
    expect(
      isMediaPlaybackInterruption({
        name: "AbortError",
        message: "The play() request was interrupted by a call to pause().",
      }),
    ).toBe(true);
  });

  it("treats a load-interrupted play request as expected", () => {
    expect(
      isMediaPlaybackInterruption({
        message: "The play() request was interrupted by a new load request.",
      }),
    ).toBe(true);
  });

  it("keeps unrelated playback failures actionable", () => {
    expect(
      isMediaPlaybackInterruption({
        name: "NotAllowedError",
        message: "play() failed because the user didn't interact with the document first.",
      }),
    ).toBe(false);
  });
});
