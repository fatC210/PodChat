import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectDominantMessageLanguage } from "@/lib/chat";
import { formatDurationLabel, type IntegrationSettings, type SummaryEmotion } from "@/lib/podchat-data";
import { resolveTranscriptionDurationSeconds } from "@/lib/transcript-duration";
import { fetchWithUpstreamErrorContext, normalizeValue, readUpstreamError } from "@/lib/server/integrations";
import { resolveElevenLabsTranscriptionRequestOptions } from "@/lib/server/elevenlabs-transcription";

interface ElevenLabsWord {
  text?: string;
  start?: number;
  end?: number;
  type?: string;
  speaker_id?: string | number;
}

interface ElevenLabsSpeechToTextResponse {
  language_code?: string;
  language_probability?: number;
  text?: string;
  words?: ElevenLabsWord[];
}

export interface ElevenLabsVoice {
  voice_id?: string;
  name?: string;
  category?: string;
}

export interface ElevenLabsSubscription {
  voice_slots_used?: number;
  voice_limit?: number;
}

export interface ElevenLabsTranscriptLine {
  id: string;
  speakerKey: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface ElevenLabsSpeakerSample {
  id: string;
  name: string;
  pct: number;
  preview: string;
  duration: string;
}

const dataDir = path.join(process.cwd(), ".podchat");
const generatedDir = path.join(dataDir, "generated");
const speakerColors = ["text-accent", "text-info", "text-warning", "text-success"];

export function hasElevenLabsConfig(settings: Pick<IntegrationSettings, "elevenlabs">) {
  return Boolean(normalizeValue(settings.elevenlabs));
}

function inferMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function clampSeconds(value: number) {
  return Math.max(0, value);
}

function cleanWordText(word: string) {
  return word.replace(/\s+/g, " ");
}

function shouldBreakTranscriptLine(
  currentWords: ElevenLabsWord[],
  nextWord: ElevenLabsWord,
  currentSpeakerKey: string,
) {
  if (currentWords.length === 0) {
    return false;
  }

  const previousWord = currentWords[currentWords.length - 1];
  const nextSpeakerKey = String(nextWord.speaker_id ?? currentSpeakerKey);
  const currentText = currentWords.map((word) => word.text ?? "").join("").trim();
  const previousText = previousWord.text ?? "";
  const gap = clampSeconds((nextWord.start ?? previousWord.end ?? 0) - (previousWord.end ?? previousWord.start ?? 0));

  if (nextSpeakerKey !== currentSpeakerKey) {
    return true;
  }

  if (gap > 1.2) {
    return true;
  }

  if (/[.!?。！？]$/.test(previousText) && currentText.length > 36) {
    return true;
  }

  if (currentText.length > 180) {
    return true;
  }

  return false;
}

function normalizeWordText(word: ElevenLabsWord) {
  const text = word.text ?? "";
  return word.type === "spacing" ? text : cleanWordText(text);
}

function buildTranscriptLinesFromWords(words: ElevenLabsWord[]) {
  const filteredWords = words.filter((word) => typeof word.text === "string" && word.text.length > 0);

  if (filteredWords.length === 0) {
    return [];
  }

  const lines: ElevenLabsTranscriptLine[] = [];
  let currentSpeakerKey = String(filteredWords[0]?.speaker_id ?? "speaker-1");
  let bucket: ElevenLabsWord[] = [];

  const flush = () => {
    if (bucket.length === 0) {
      return;
    }

    const text = bucket.map(normalizeWordText).join("").replace(/\s+/g, " ").trim();

    if (!text) {
      bucket = [];
      return;
    }

    lines.push({
      id: `line-${lines.length + 1}`,
      speakerKey: currentSpeakerKey,
      startSeconds: bucket[0]?.start ?? 0,
      endSeconds: bucket[bucket.length - 1]?.end ?? bucket[bucket.length - 1]?.start ?? bucket[0]?.start ?? 0,
      text,
    });

    bucket = [];
  };

  for (const word of filteredWords) {
    const nextSpeakerKey = String(word.speaker_id ?? currentSpeakerKey);

    if (shouldBreakTranscriptLine(bucket, word, currentSpeakerKey)) {
      flush();
      currentSpeakerKey = nextSpeakerKey;
    }

    if (bucket.length === 0) {
      currentSpeakerKey = nextSpeakerKey;
    }

    bucket.push(word);
  }

  flush();
  return lines;
}

function buildTranscriptLinesFromText(text: string) {
  const parts = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.map((part, index) => ({
    id: `line-${index + 1}`,
    speakerKey: "speaker-1",
    startSeconds: index * 8,
    endSeconds: index * 8 + 7,
    text: part,
  }));
}

export async function transcribeAudioWithElevenLabs(
  settings: Pick<IntegrationSettings, "elevenlabs">,
  input: {
    fileName: string;
    fileBytes: Buffer;
    diarize?: boolean;
    referenceSpeakerCount?: number | null;
  },
) {
  if (!hasElevenLabsConfig(settings)) {
    throw new Error("ElevenLabs API key is required for transcription.");
  }

  const fileBytes = new Uint8Array(input.fileBytes);
  const file = new File([fileBytes], path.basename(input.fileName), {
    type: inferMimeType(input.fileName),
  });
  const transcriptionOptions = resolveElevenLabsTranscriptionRequestOptions({
    diarize: input.diarize,
    referenceSpeakerCount: input.referenceSpeakerCount,
  });
  const formData = new FormData();
  formData.set("file", file);
  formData.set("model_id", transcriptionOptions.modelId);
  formData.set("tag_audio_events", "false");
  formData.set("timestamps_granularity", "word");
  formData.set("diarize", transcriptionOptions.diarize ? "true" : "false");

  if (transcriptionOptions.numSpeakers) {
    formData.set("num_speakers", String(transcriptionOptions.numSpeakers));
  }

  const response = await fetchWithUpstreamErrorContext("ElevenLabs speech-to-text API", "https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": settings.elevenlabs,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const payload = (await response.json()) as ElevenLabsSpeechToTextResponse;
  const hasWordTimestamps = Array.isArray(payload.words) && payload.words.length > 0;
  const transcriptLines = hasWordTimestamps
    ? buildTranscriptLinesFromWords(payload.words)
    : buildTranscriptLinesFromText(payload.text ?? "");

  if (transcriptLines.length === 0) {
    throw new Error("ElevenLabs transcription returned no transcript text.");
  }

  const durationSeconds = resolveTranscriptionDurationSeconds(transcriptLines, hasWordTimestamps);

  return {
    durationSeconds,
    transcriptLines,
    rawText: payload.text?.trim() ?? transcriptLines.map((line) => line.text).join(" "),
  };
}

export async function listElevenLabsVoices(settings: Pick<IntegrationSettings, "elevenlabs">) {
  if (!hasElevenLabsConfig(settings)) {
    return [];
  }

  const response = await fetchWithUpstreamErrorContext("ElevenLabs voices API", "https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": settings.elevenlabs,
    },
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const payload = (await response.json()) as {
    voices?: ElevenLabsVoice[];
  };

  return payload.voices ?? [];
}

export async function getElevenLabsSubscription(settings: Pick<IntegrationSettings, "elevenlabs">) {
  if (!hasElevenLabsConfig(settings)) {
    return {
      voiceSlotsUsed: null,
      voiceLimit: null,
    };
  }

  const response = await fetchWithUpstreamErrorContext("ElevenLabs subscription API", "https://api.elevenlabs.io/v1/user/subscription", {
    headers: {
      "xi-api-key": settings.elevenlabs,
    },
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const payload = (await response.json()) as ElevenLabsSubscription;

  return {
    voiceSlotsUsed: typeof payload.voice_slots_used === "number" ? payload.voice_slots_used : null,
    voiceLimit: typeof payload.voice_limit === "number" ? payload.voice_limit : null,
  };
}

export async function deleteElevenLabsVoice(
  settings: Pick<IntegrationSettings, "elevenlabs">,
  voiceId: string,
) {
  if (!hasElevenLabsConfig(settings) || !normalizeValue(voiceId)) {
    return false;
  }

  const response = await fetchWithUpstreamErrorContext("ElevenLabs voice deletion API", `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
    headers: {
      "xi-api-key": settings.elevenlabs,
    },
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  return true;
}

export async function resolveElevenLabsVoice(settings: Pick<IntegrationSettings, "elevenlabs" | "elevenlabsVoiceId">) {
  const voices = await listElevenLabsVoices(settings);

  if (voices.length === 0) {
    throw new Error("No ElevenLabs voices are available for this account.");
  }

  const preferredId = normalizeValue(settings.elevenlabsVoiceId);
  const preferredVoice = preferredId
    ? voices.find((voice) => voice.voice_id === preferredId)
    : null;
  const selectedVoice = preferredVoice ?? voices[0];

  if (!selectedVoice?.voice_id) {
    throw new Error("Failed to resolve an ElevenLabs voice ID.");
  }

  return {
    voiceId: selectedVoice.voice_id,
    voiceName: selectedVoice.name?.trim() || "ElevenLabs Voice",
  };
}

function hashSummaryAudioKey(parts: string[]) {
  return createHash("sha1").update(parts.join("|")).digest("hex");
}

export async function synthesizeTextWithElevenLabs(
  settings: Pick<IntegrationSettings, "elevenlabs" | "elevenlabsVoiceId">,
  input: {
    text: string;
    cacheKeyParts: string[];
    voiceIdOverride?: string | null;
    emotion?: SummaryEmotion | "neutral";
    languageCode?: "zh" | "en";
  },
) {
  if (!hasElevenLabsConfig(settings)) {
    throw new Error("ElevenLabs API key is required for speech synthesis.");
  }

  const overrideVoiceId = normalizeValue(input.voiceIdOverride);
  const { voiceId } = overrideVoiceId
    ? { voiceId: overrideVoiceId }
    : await resolveElevenLabsVoice(settings);
  const resolvedLanguageCode = input.languageCode ?? detectDominantMessageLanguage(input.text) ?? undefined;
  const audioKey = hashSummaryAudioKey([
    ...input.cacheKeyParts,
    voiceId,
    resolvedLanguageCode ?? "auto",
    input.text,
  ]);
  const audioPath = path.join(generatedDir, `${audioKey}.mp3`);
  const emotion = input.emotion ?? "neutral";
  const voiceSettings =
    emotion === "excited"
      ? { stability: 0.3, similarity_boost: 0.75, style: 0.8, speed: 1.06 }
      : emotion === "lighthearted" || emotion === "humorous"
      ? { stability: 0.4, similarity_boost: 0.75, style: 0.65, speed: 1.02 }
      : emotion === "serious"
      ? { stability: 0.55, similarity_boost: 0.8, style: 0.35, speed: 0.96 }
      : emotion === "reflective"
      ? { stability: 0.5, similarity_boost: 0.78, style: 0.45, speed: 0.94 }
      : { stability: 0.45, similarity_boost: 0.75, style: 0.5, speed: 1 };

  try {
    await stat(audioPath);
    return {
      audioPath,
      voiceId,
      contentType: "audio/mpeg",
    };
  } catch {
    void 0;
  }

  await mkdir(generatedDir, { recursive: true });

  const response = await fetchWithUpstreamErrorContext("ElevenLabs text-to-speech API", `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": settings.elevenlabs,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      model_id: "eleven_multilingual_v2",
      ...(resolvedLanguageCode ? { language_code: resolvedLanguageCode } : {}),
      text: input.text,
      voice_settings: {
        ...voiceSettings,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(audioPath, bytes);

  return {
    audioPath,
    voiceId,
    contentType: "audio/mpeg",
  };
}

export function buildSpeakerPresentation(
  transcriptLines: ElevenLabsTranscriptLine[],
  aiHost: string,
  guestName: string,
) {
  const speakerDurations = new Map<string, number>();

  for (const line of transcriptLines) {
    speakerDurations.set(
      line.speakerKey,
      (speakerDurations.get(line.speakerKey) ?? 0) + Math.max(1, line.endSeconds - line.startSeconds),
    );
  }

  const rankedSpeakers = [...speakerDurations.entries()].sort((a, b) => b[1] - a[1]);
  const totalDuration = rankedSpeakers.reduce((total, [, duration]) => total + duration, 0) || 1;

  const speakerLabelMap = new Map<string, { label: string; color: string }>();
  rankedSpeakers.forEach(([speakerKey], index) => {
    if (index === 0) {
      speakerLabelMap.set(speakerKey, { label: aiHost, color: speakerColors[0] });
      return;
    }

    if (index === 1 && guestName) {
      speakerLabelMap.set(speakerKey, { label: guestName, color: speakerColors[1] });
      return;
    }

    speakerLabelMap.set(speakerKey, {
      label: `Speaker ${index + 1}`,
      color: speakerColors[index % speakerColors.length],
    });
  });

  const transcript = transcriptLines.map((line) => {
    const speaker = speakerLabelMap.get(line.speakerKey) ?? {
      label: "Speaker 1",
      color: speakerColors[0],
    };

    return {
      id: line.id,
      speakerId: line.speakerKey,
      speaker: speaker.label,
      color: speaker.color,
      time: formatDurationLabel(Math.floor(line.startSeconds)),
      endTime: formatDurationLabel(Math.ceil(line.endSeconds)),
      text: line.text,
      translation: line.text,
    };
  });

  const speakers: ElevenLabsSpeakerSample[] = rankedSpeakers.map(([speakerKey, duration], index) => {
    const speaker = speakerLabelMap.get(speakerKey) ?? {
      label: `Speaker ${index + 1}`,
      color: speakerColors[index % speakerColors.length],
    };
    const firstLine = transcript.find((line) => line.speaker === speaker.label);

    return {
      id: speakerKey,
      name: speaker.label,
      pct: Math.max(1, Math.round((duration / totalDuration) * 100)),
      preview: firstLine?.text.slice(0, 48) || speaker.label,
      duration: formatDurationLabel(Math.floor(duration)),
    };
  });

  return {
    transcript,
    speakers,
  };
}
