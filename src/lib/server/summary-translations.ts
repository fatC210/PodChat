import "server-only";

import {
  getSummary,
  getSummaryTranslation,
  getTargetLangLabel,
  isSupportedTargetLang,
  upsertSummaryTranslation,
  type IntegrationSettings,
  type Podcast,
} from "@/lib/podchat-data";
import { hasLlmConfig, requestOpenAiCompatibleText } from "@/lib/server/integrations";
import { updateStoredPodcast } from "@/lib/server/podcast-store";

interface EnsureSummaryTranslationInput {
  podcast: Podcast;
  duration: number;
  targetLang: string;
  settings: IntegrationSettings;
}

export async function ensureSummaryTranslation(input: EnsureSummaryTranslationInput) {
  const normalizedTargetLang = input.targetLang.trim().toLowerCase();

  if (!isSupportedTargetLang(normalizedTargetLang)) {
    throw new Error("Summary translation language is invalid.");
  }

  const summary = getSummary(input.podcast, input.duration);

  if (!summary) {
    throw new Error("Summary not found.");
  }

  const cachedTranslation = getSummaryTranslation(summary, normalizedTargetLang);

  if (cachedTranslation) {
    return {
      text: cachedTranslation,
      podcast: input.podcast,
    };
  }

  if (!hasLlmConfig(input.settings)) {
    throw new Error("LLM settings are incomplete. Configure the model before requesting summary translation.");
  }

  const targetLangLabel = getTargetLangLabel(normalizedTargetLang);
  const translatedText = (
    await requestOpenAiCompatibleText(input.settings, {
      temperature: 0.1,
      max_tokens: 2400,
      messages: [
        {
          role: "system",
          content: [
            "You translate podcast summaries for a web application.",
            "Reply with the translated summary only.",
            "Keep the same meaning, pacing, and spoken tone as the source.",
            "Preserve paragraph breaks when they exist.",
            "Do not add titles, notes, bullets, or markdown.",
            `Translate into ${targetLangLabel}.`,
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Podcast title: ${input.podcast.title}`,
            `Target language: ${targetLangLabel} (${normalizedTargetLang})`,
            "Summary:",
            summary.text,
          ].join("\n\n"),
        },
      ],
    })
  ).trim();

  if (!translatedText) {
    throw new Error("LLM returned an empty summary translation.");
  }

  const updatedPodcast = await updateStoredPodcast(input.podcast.id, (currentPodcast) => ({
    ...currentPodcast,
    summaries: currentPodcast.summaries.map((entry) =>
      entry.duration === input.duration
        ? upsertSummaryTranslation(entry, normalizedTargetLang, translatedText)
        : entry,
    ),
  }));

  if (!updatedPodcast) {
    throw new Error("Podcast not found.");
  }

  return {
    text: translatedText,
    podcast: updatedPodcast,
  };
}
