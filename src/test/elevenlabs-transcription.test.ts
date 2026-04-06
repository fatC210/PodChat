import { describe, expect, it } from "vitest";
import { resolveElevenLabsTranscriptionRequestOptions } from "@/lib/server/elevenlabs-transcription";

describe("resolveElevenLabsTranscriptionRequestOptions", () => {
  it("uses scribe_v2 and passes a speaker-count hint for diarized multi-speaker audio", () => {
    expect(
      resolveElevenLabsTranscriptionRequestOptions({
        diarize: true,
        referenceSpeakerCount: 4,
      }),
    ).toEqual({
      modelId: "scribe_v2",
      diarize: true,
      numSpeakers: 4,
    });
  });

  it("omits the speaker-count hint when diarization is disabled", () => {
    expect(
      resolveElevenLabsTranscriptionRequestOptions({
        diarize: false,
        referenceSpeakerCount: 4,
      }),
    ).toEqual({
      modelId: "scribe_v2",
      diarize: false,
    });
  });

  it("ignores unusable speaker counts and caps excessive values", () => {
    expect(
      resolveElevenLabsTranscriptionRequestOptions({
        diarize: true,
        referenceSpeakerCount: 1,
      }),
    ).toEqual({
      modelId: "scribe_v2",
      diarize: true,
    });

    expect(
      resolveElevenLabsTranscriptionRequestOptions({
        diarize: true,
        referenceSpeakerCount: 99,
      }),
    ).toEqual({
      modelId: "scribe_v2",
      diarize: true,
      numSpeakers: 32,
    });
  });
});
