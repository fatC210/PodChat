import type { IntegrationSettings, Podcast } from "@/lib/podchat-data";

export type ChatRole = "user" | "ai";

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

export function buildChatGreeting(podcast: Podcast) {
  if (!podcast.aiHost || podcast.transcript.length === 0) {
    return "This podcast is not ready for chat yet. Finish backend processing first.";
  }

  return `You were just listening to ${podcast.title}. Want to unpack the strongest idea, the practical takeaway, or what the host got wrong?`;
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
    "Keep answers conversational, concise, and useful. Match the user's language whenever possible.",
  ].join("\n\n");
}

export function buildVoiceAgentPrompt(podcast: Podcast) {
  return [
    buildChatSystemPrompt(podcast),
    "You are in a live voice conversation.",
    "Respond naturally in spoken language, keep each turn short unless the user asks for detail.",
    "Do not read URLs aloud unless the user explicitly asks.",
    "If the user interrupts, continue from the latest question instead of finishing the old answer.",
  ].join("\n\n");
}

export function buildVoiceAgentFirstMessage(podcast: Podcast) {
  return buildChatGreeting(podcast);
}
