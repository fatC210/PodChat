export interface ElevenLabsTranscriptionRequestOptions {
  modelId: string;
  diarize: boolean;
  numSpeakers?: number;
}

const elevenLabsTranscriptionModelId = "scribe_v2";
const maxSupportedSpeakerCount = 32;

function normalizeSpeakerCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);

  if (rounded < 2) {
    return null;
  }

  return Math.min(rounded, maxSupportedSpeakerCount);
}

export function resolveElevenLabsTranscriptionRequestOptions(input: {
  diarize?: boolean;
  referenceSpeakerCount?: number | null;
}): ElevenLabsTranscriptionRequestOptions {
  const diarize = input.diarize !== false;
  const numSpeakers = diarize ? normalizeSpeakerCount(input.referenceSpeakerCount) : null;

  return {
    modelId: elevenLabsTranscriptionModelId,
    diarize,
    ...(numSpeakers ? { numSpeakers } : {}),
  };
}
