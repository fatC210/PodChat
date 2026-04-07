import type { IntegrationSettings, Podcast } from "@/lib/podchat-data";

export type ChatRole = "user" | "ai";
export type VoiceAgentLanguage = "en" | "zh";

export interface ChatHistoryMessage {
  role: ChatRole;
  text: string;
}

export interface ChatRequestBody {
  podcast: Podcast;
  question: string;
  history: ChatHistoryMessage[];
  integrationSettings?: Pick<IntegrationSettings, "llmKey" | "llmUrl" | "llmModel">;
}

export interface ChatResponseBody {
  reply: string;
  provider: "llm";
}

export type IntegrationProvider = "elevenlabs" | "firecrawl" | "llm";

export interface IntegrationTestRequestBody {
  provider: IntegrationProvider;
  settings: IntegrationSettings;
}

export interface IntegrationTestResponseBody {
  ok: boolean;
  provider: IntegrationProvider;
  code:
    | "ok"
    | "ok_firecrawl"
    | "ok_llm"
    | "missing_api_key"
    | "missing_llm_config"
    | "unsupported_provider"
    | "upstream_error";
  detail?: string;
  remainingCredits?: number;
  model?: string;
}

function shouldPreferMandarinSpokenChinese(podcast: Podcast) {
  if (podcast.targetLang === "zh") {
    return true;
  }

  return /[\u4E00-\u9FFF]/u.test(podcast.persona.languagePref);
}

const CHINESE_CHARACTER_PATTERN = /[\u3400-\u9FFF]/gu;
const ENGLISH_LETTER_PATTERN = /[A-Za-z]/g;
const EXPLICIT_ENGLISH_REPLY_PATTERN =
  /(please\s+)?(reply|respond|answer|speak|talk)\s+in\s+english|use\s+english|\u8bf7\u7528\u82f1\u6587|\u8bf7\u7528\u82f1\u8bed|\u7528\u82f1\u6587\u56de\u590d|\u7528\u82f1\u8bed\u56de\u590d|\u82f1\u6587\u56de\u7b54|\u82f1\u8bed\u56de\u7b54|\u8bf4\u82f1\u6587|\u8bf4\u82f1\u8bed/iu;
const EXPLICIT_MANDARIN_REPLY_PATTERN =
  /(please\s+)?(reply|respond|answer|speak|talk)\s+in\s+(mandarin|putonghua|chinese)|use\s+(mandarin|putonghua|chinese)|\u8bf7\u7528\u4e2d\u6587|\u7528\u4e2d\u6587\u56de\u590d|\u4e2d\u6587\u56de\u7b54|\u8bf7\u7528\u666e\u901a\u8bdd|\u7528\u666e\u901a\u8bdd\u56de\u590d|\u666e\u901a\u8bdd\u56de\u7b54|\u8bf4\u4e2d\u6587|\u8bf4\u666e\u901a\u8bdd/iu;
const EXPLICIT_CANTONESE_REPLY_PATTERN =
  /(please\s+)?(reply|respond|answer|speak|talk)\s+in\s+cantonese|use\s+cantonese|\u8bf7\u7528\u7ca4\u8bed|\u7528\u7ca4\u8bed\u56de\u590d|\u7ca4\u8bed\u56de\u7b54|\u8bf7\u7528\u5e7f\u4e1c\u8bdd|\u8bf7\u7528\u5ee3\u6771\u8a71|\u8bf4\u7ca4\u8bed|\u8bf4\u5e7f\u4e1c\u8bdd|\u8bf4\u5ee3\u6771\u8a71|\u7ca4\u8bed|\u5e7f\u4e1c\u8bdd|\u5ee3\u6771\u8a71/iu;

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function detectDominantMessageLanguage(text: string): VoiceAgentLanguage | null {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return null;
  }

  const chineseCharacterCount = countMatches(normalizedText, CHINESE_CHARACTER_PATTERN);
  const englishLetterCount = countMatches(normalizedText, ENGLISH_LETTER_PATTERN);

  if (chineseCharacterCount === 0 && englishLetterCount === 0) {
    return null;
  }

  return chineseCharacterCount >= englishLetterCount ? "zh" : "en";
}

interface ReplyLanguageDirective {
  language: VoiceAgentLanguage;
  context: string;
}

function detectExplicitReplyLanguage(text: string): ReplyLanguageDirective | null {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return null;
  }

  if (EXPLICIT_CANTONESE_REPLY_PATTERN.test(normalizedText)) {
    return {
      language: "zh",
      context:
        "For your next reply, the user explicitly asked for Cantonese. Reply in Cantonese and speak the answer in Cantonese.",
    };
  }

  if (EXPLICIT_ENGLISH_REPLY_PATTERN.test(normalizedText)) {
    return {
      language: "en",
      context:
        "For your next reply, the user explicitly asked for English. Reply in English and speak the answer in English.",
    };
  }

  if (EXPLICIT_MANDARIN_REPLY_PATTERN.test(normalizedText)) {
    return {
      language: "zh",
      context:
        "For your next reply, the user explicitly asked for Mandarin Chinese (Putonghua). Reply in Mandarin Chinese and speak with standard Mandarin pronunciation.",
    };
  }

  return null;
}

export function resolveVoiceAgentLanguage(podcast: Podcast, userText?: string): VoiceAgentLanguage {
  const explicitReplyLanguage = userText ? detectExplicitReplyLanguage(userText) : null;

  if (explicitReplyLanguage) {
    return explicitReplyLanguage.language;
  }

  const dominantLanguage = userText ? detectDominantMessageLanguage(userText) : null;

  if (dominantLanguage) {
    return dominantLanguage;
  }

  return shouldPreferMandarinSpokenChinese(podcast) ? "zh" : "en";
}

export function buildVoiceReplyLanguageContext(userText: string) {
  const explicitReplyLanguage = detectExplicitReplyLanguage(userText);

  if (explicitReplyLanguage) {
    return explicitReplyLanguage.context;
  }

  const dominantLanguage = detectDominantMessageLanguage(userText);

  if (dominantLanguage === "zh") {
    return "For your next reply, the user's latest message is in Chinese. Reply in Mandarin Chinese (Putonghua) and speak with standard Mandarin pronunciation. Do not switch to Cantonese unless the user explicitly asks for Cantonese.";
  }

  if (dominantLanguage === "en") {
    return "For your next reply, the user's latest message is in English. Reply in English and speak the answer in English.";
  }

  return null;
}

export function buildChatGreeting(podcast: Podcast) {
  if (!podcast.aiHost || podcast.transcript.length === 0) {
    return "This podcast is not ready for chat yet. Finish backend processing first.";
  }

  if (shouldPreferMandarinSpokenChinese(podcast)) {
    return `\u4f60\u521a\u521a\u5728\u542c ${podcast.title}\uff0c\u60f3\u5148\u804a\u54ea\u4e2a\u89c2\u70b9\uff1f`;
  }

  return `You were just listening to ${podcast.title}. What should we unpack first?`;
}

export function buildChatSystemPrompt(podcast: Podcast) {
  const summary = podcast.summaries.find((entry) => entry.duration === 3) ?? podcast.summaries[0] ?? null;
  const transcriptExcerpt = podcast.transcript
    .slice(0, 6)
    .map((line) => `[${line.time}] ${line.speaker}: ${line.text}`)
    .join("\n") || "No transcript is available yet.";
  const references = podcast.crawledPages
    .slice(0, 3)
    .map((page) =>
      [
        `- ${page.title}`,
        `  URL: ${page.url}`,
        page.matchedTerms?.length ? `  Matched terms: ${page.matchedTerms.join(", ")}` : "",
        page.excerpt ? `  Excerpt: ${page.excerpt}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n") || "No reference pages are available yet.";

  return [
    `You are ${podcast.aiHost ?? "the AI host"} speaking as the host of the podcast "${podcast.title}".`,
    `Podcast topic: ${podcast.topic}. Guest: ${podcast.guestName}.`,
    `Persona guidance: ${podcast.persona.personality}. Catchphrases: ${podcast.persona.catchphrases}. Answer style: ${podcast.persona.answerStyle}. Language preference: ${podcast.persona.languagePref}.`,
    `Short summary:\n${summary ? summary.text : "No summary is available yet."}`,
    `Transcript excerpt:\n${transcriptExcerpt}`,
    `Reference pages:\n${references}`,
    "Answer as the host, stay grounded in the provided material, and say clearly when the context is insufficient.",
    "Keep answers conversational, concise, and useful.",
    "Unless the user explicitly asks for a specific reply language, follow the language of the user's latest message for both the reply text and the spoken audio.",
    "If the user's latest message is in Chinese, reply in Mandarin Chinese (Putonghua) with standard Mandarin pronunciation. Do not switch to Cantonese unless the user explicitly asks for Cantonese.",
    "If the user's latest message is in English, reply in English and speak the answer in English.",
  ].filter(Boolean).join("\n\n");
}

export function buildVoiceAgentPrompt(podcast: Podcast) {
  return [
    buildChatSystemPrompt(podcast),
    "You are in a live voice conversation.",
    "Respond naturally in spoken language, keep each turn short unless the user asks for detail.",
    "Do not read URLs aloud unless the user explicitly asks.",
    "If the user interrupts, continue from the latest question instead of finishing the old answer.",
    'Treat silence or punctuation-only input such as "..." as no input and do not answer it.',
  ].join("\n\n");
}

export function buildVoiceAgentFirstMessage(podcast: Podcast) {
  return buildChatGreeting(podcast);
}
