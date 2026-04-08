import "server-only";

import {
  getTargetLangLabel,
  getTranscriptTranslation,
  isSupportedTargetLang,
  upsertTranscriptTranslation,
  type IntegrationSettings,
  type Podcast,
  type TranscriptLine,
} from "@/lib/podchat-data";
import { hasLlmConfig, requestOpenAiCompatibleJson } from "@/lib/server/integrations";
import { updateStoredPodcast } from "@/lib/server/podcast-store";

interface EnsureTranscriptTranslationInput {
  podcast: Podcast;
  targetLang: string;
  settings: IntegrationSettings;
}

interface TranscriptTranslationResponse {
  translations?: Record<string, string>;
}

const maxLinesPerChunk = 30;
const maxChunkChars = 2200;

function createTranscriptTranslationChunks(lines: TranscriptLine[]) {
  const chunks: TranscriptLine[][] = [];
  let currentChunk: TranscriptLine[] = [];
  let currentChunkChars = 0;

  for (const line of lines) {
    const lineChars = line.id.length + line.speaker.length + line.text.length + 16;
    const shouldStartNewChunk =
      currentChunk.length >= maxLinesPerChunk ||
      (currentChunk.length > 0 && currentChunkChars + lineChars > maxChunkChars);

    if (shouldStartNewChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkChars = 0;
    }

    currentChunk.push(line);
    currentChunkChars += lineChars;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function normalizeChunkTranslations(
  chunk: TranscriptLine[],
  payload: TranscriptTranslationResponse,
) {
  if (!payload.translations || typeof payload.translations !== "object" || Array.isArray(payload.translations)) {
    throw new Error("LLM returned transcript translations in an invalid format.");
  }

  return Object.fromEntries(
    chunk.map((line) => {
      const translatedText = payload.translations?.[line.id]?.trim() ?? "";

      if (!translatedText) {
        throw new Error(`LLM omitted a transcript translation for ${line.id}.`);
      }

      return [line.id, translatedText] as const;
    }),
  );
}

async function translateTranscriptChunk(
  settings: IntegrationSettings,
  podcast: Podcast,
  targetLang: string,
  chunk: TranscriptLine[],
) {
  const targetLangLabel = getTargetLangLabel(targetLang);
  const payload = await requestOpenAiCompatibleJson<TranscriptTranslationResponse>(settings, {
    temperature: 0.1,
    max_tokens: 3200,
    messages: [
      {
        role: "system",
        content: [
          "You translate podcast transcript lines for a web application.",
          'Return JSON only with this exact shape: {"translations":{"line-id":"translated text"}}.',
          "Translate every provided line into the requested target language.",
          "Keep meaning, spoken tone, and line boundaries aligned with the source.",
          "Do not skip, merge, summarize, reorder, or annotate lines.",
          "Keep URLs, product names, and code tokens intact when appropriate.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Podcast title: ${podcast.title}`,
          `Target language: ${targetLangLabel} (${targetLang})`,
          "Transcript lines:",
          JSON.stringify(
            chunk.map((line) => ({
              id: line.id,
              speaker: line.speaker,
              text: line.text,
            })),
          ),
        ].join("\n\n"),
      },
    ],
  });

  return normalizeChunkTranslations(chunk, payload);
}

export async function ensureTranscriptTranslation(input: EnsureTranscriptTranslationInput) {
  const normalizedTargetLang = input.targetLang.trim().toLowerCase();

  if (!isSupportedTargetLang(normalizedTargetLang)) {
    throw new Error("Transcript translation language is invalid.");
  }

  if (input.podcast.transcript.length === 0) {
    throw new Error("Podcast transcript is unavailable.");
  }

  const cachedTranslations = Object.fromEntries(
    input.podcast.transcript
      .map((line) => {
        const cachedTranslation = getTranscriptTranslation(line, normalizedTargetLang);
        return cachedTranslation ? ([line.id, cachedTranslation] as const) : null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );

  const missingLines = input.podcast.transcript.filter((line) => !cachedTranslations[line.id]);

  if (missingLines.length === 0) {
    return {
      targetLang: normalizedTargetLang,
      translations: cachedTranslations,
      podcast: input.podcast,
    };
  }

  if (!hasLlmConfig(input.settings)) {
    throw new Error("LLM settings are incomplete. Configure the model before requesting transcript translation.");
  }

  const generatedTranslations: Record<string, string> = {};

  for (const chunk of createTranscriptTranslationChunks(missingLines)) {
    Object.assign(
      generatedTranslations,
      await translateTranscriptChunk(input.settings, input.podcast, normalizedTargetLang, chunk),
    );
  }

  if (Object.keys(generatedTranslations).length === 0) {
    throw new Error("LLM returned an empty transcript translation.");
  }

  const updatedPodcast = await updateStoredPodcast(input.podcast.id, (currentPodcast) => ({
    ...currentPodcast,
    transcript: currentPodcast.transcript.map((line) => {
      const translatedText = generatedTranslations[line.id];
      return translatedText
        ? upsertTranscriptTranslation(line, normalizedTargetLang, translatedText)
        : line;
    }),
  }));

  if (!updatedPodcast) {
    throw new Error("Podcast not found.");
  }

  return {
    targetLang: normalizedTargetLang,
    translations: {
      ...cachedTranslations,
      ...generatedTranslations,
    },
    podcast: updatedPodcast,
  };
}
