import {
  buildChatSystemPrompt,
  buildGroupChatSystemPrompt,
  detectDominantMessageLanguage,
  detectBroadGroupSolicitation,
  type ChatSpeechEmotion,
  type ChatHistoryMessage,
  type ChatMention,
  type ChatMode,
  type ChatReplyMessage,
  type ChatResponseBody,
  type IntegrationProvider,
  type IntegrationTestResponseBody,
  getResolvedChatMode,
  parseChatMentions,
} from "@/lib/chat";
import {
  isPodcastReady,
  normalizeSummaryEmotion,
  type IntegrationSettings,
  type Podcast,
} from "@/lib/podchat-data";

export type LlmSettings = Pick<IntegrationSettings, "llmKey" | "llmUrl" | "llmModel">;
const maxNonStreamingCompletionTokens = 4096;

interface UpstreamErrorPayload {
  error?: string | { message?: string };
  message?: string;
  detail?: string;
}

interface FetchFailureCause {
  address?: unknown;
  code?: unknown;
  errno?: unknown;
  hostname?: unknown;
  message?: unknown;
  port?: unknown;
  syscall?: unknown;
}

export function normalizeValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function hasLlmConfig(settings: LlmSettings) {
  return Boolean(normalizeValue(settings.llmUrl) && normalizeValue(settings.llmKey) && normalizeValue(settings.llmModel));
}

export function hasFirecrawlConfig(settings: Pick<IntegrationSettings, "firecrawl">) {
  return Boolean(normalizeValue(settings.firecrawl));
}

export function resolveOpenAiCompatibleUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");

  if (normalizedBase.endsWith(`/${normalizedPath}`)) {
    return normalizedBase;
  }

  return `${normalizedBase}/${normalizedPath}`;
}

function buildFetchFailureMessage(serviceLabel: string, error: unknown) {
  const errorMessage = error instanceof Error ? normalizeValue(error.message) : "";
  const cause =
    error instanceof Error && error.cause && typeof error.cause === "object"
      ? (error.cause as FetchFailureCause)
      : null;
  const detailParts = [
    normalizeValue(cause?.code),
    normalizeValue(cause?.syscall),
    normalizeValue(cause?.hostname),
    normalizeValue(cause?.address),
    normalizeValue(cause?.port),
    normalizeValue(cause?.message),
    errorMessage.toLowerCase() === "fetch failed" ? "" : errorMessage,
  ].filter(Boolean);

  if (detailParts.length === 0) {
    return `Failed to reach ${serviceLabel}. Check network access, proxy settings, and API host availability.`;
  }

  return `Failed to reach ${serviceLabel}: ${detailParts.join(" | ")}.`;
}

export async function fetchWithUpstreamErrorContext(
  serviceLabel: string,
  input: string | URL | Request,
  init?: RequestInit,
) {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw new Error(buildFetchFailureMessage(serviceLabel, error));
  }
}

export async function readUpstreamError(response: Response) {
  try {
    const raw = await response.text();
    const data = JSON.parse(raw) as UpstreamErrorPayload;

    if (typeof data?.error === "string") {
      return data.error;
    }

    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (raw.trim()) {
      return raw.trim();
    }
  } catch {
    void 0;
  }

  return `Upstream request failed with status ${response.status}`;
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function cleanJsonFence(input: string) {
  const trimmed = input.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

interface StructuredChatReplyPayload {
  displayText?: string;
  speechText?: string;
  speechStyle?: string;
  speechEmotion?: string | null;
}

interface NormalizedStructuredChatReply {
  displayText: string;
  speechText: string;
  speechStyle?: string;
  speechEmotion?: ChatSpeechEmotion;
}

const structuredReplyEmotionOptions = [
  "neutral",
  "lighthearted",
  "serious",
  "excited",
  "reflective",
  "humorous",
] as const;

function injectSystemInstruction<T extends { role: "system" | "assistant" | "user"; content: string }>(
  messages: T[],
  content: string,
) {
  if (messages[0]?.role === "system") {
    return [
      messages[0],
      { role: "system" as const, content },
      ...messages.slice(1),
    ];
  }

  return [{ role: "system" as const, content }, ...messages];
}

function buildStructuredReplyInstruction() {
  return [
    "Return JSON only.",
    'Use exactly this shape: {"displayText":"...","speechText":"...","speechStyle":"...","speechEmotion":"neutral|lighthearted|serious|excited|reflective|humorous"}.',
    "displayText must contain only the final answer shown in chat. Do not include analysis, prompt text, role descriptions, routing notes, or labels such as 'Draft response'.",
    "displayText must be plain text only. Do not use markdown, headings, bullet lists, numbered lists, tables, code fences, or inline code.",
    "speechText is for TTS only. It should match the full user-facing content of displayText and must never include hidden notes or reasoning.",
    "speechText must also be plain text only. Do not use markdown, emojis, stage directions, or speaker labels.",
    "speechText must stay in the same language as displayText. Do not translate, paraphrase into another language, or transliterate it.",
    "Never omit points that appear in displayText. If you are unsure, copy displayText exactly into speechText.",
    "If displayText is in Chinese, speechText must also be in Chinese. If you are unsure, copy displayText exactly into speechText.",
    "speechStyle is hidden delivery guidance for the speech layer only. Keep it short, natural, and never include user-facing answer content.",
    `speechEmotion must be one of: ${structuredReplyEmotionOptions.join(", ")}.`,
  ].join("\n");
}

function buildPlainReplyFallbackInstruction() {
  return [
    "Return only the final user-facing reply text.",
    "Do not include analysis, routing notes, prompt text, hidden style notes, speaker labels, or labels such as 'Draft response'.",
    "Reply in plain text only. Do not use markdown, headings, bullet lists, numbered lists, tables, code fences, or inline code.",
  ].join("\n");
}

function normalizeMultilineText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
  ];

  for (const [start, end] of pairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end) && trimmed.length >= 2) {
      return trimmed.slice(start.length, trimmed.length - end.length).trim();
    }
  }

  return trimmed;
}

function findLastReplyLabelIndex(text: string) {
  const patterns = [
    /(?:draft|final|suggested|sample)\s+response\s*:\s*/gi,
    /(?:draft|final|suggested|sample)\s+reply\s*:\s*/gi,
    /(?:^|\n)\s*reply\s*:\s*/gi,
  ];
  let lastIndex = -1;

  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      const start = (match.index ?? -1) + match[0].length;

      if (start > lastIndex) {
        lastIndex = start;
      }
    }
  }

  return lastIndex;
}

function stripMarkdownFormatting(value: string) {
  return value
    .replace(/```[^\n]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^(\s{0,3}[-*_]){3,}\s*$/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function normalizeReplyWhitespace(value: string, spoken: boolean) {
  const normalized = value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (spoken) {
    return normalized.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  return normalized;
}

function sanitizeUserFacingReply(raw: string, options?: { spoken?: boolean }) {
  let text = normalizeMultilineText(cleanJsonFence(raw));
  const replyLabelIndex = findLastReplyLabelIndex(text);

  if (replyLabelIndex >= 0) {
    text = text.slice(replyLabelIndex).trim();
  }

  text = stripWrappingQuotes(text);
  text = stripMarkdownFormatting(text);
  text = text.replace(/^(?:speaker\s*\d+|assistant|ai host|host|guest)\s*:\s*/i, "").trim();

  return normalizeReplyWhitespace(text, options?.spoken ?? false);
}

function normalizeSpeechStyle(value: unknown) {
  const text = normalizeValue(value);

  if (!text) {
    return undefined;
  }

  return text.replace(/\s+/g, " ").trim();
}

function normalizeSpeechEmotion(value: unknown, speechStyle?: string) {
  const text = normalizeValue(value);

  if (text.toLowerCase() === "neutral") {
    return "neutral" satisfies ChatSpeechEmotion;
  }

  const normalized = normalizeSummaryEmotion(text);

  if (normalized) {
    return normalized satisfies ChatSpeechEmotion;
  }

  const inferredFromStyle = normalizeSummaryEmotion(speechStyle);
  return inferredFromStyle ?? ("neutral" satisfies ChatSpeechEmotion);
}

function normalizeComparableReplyText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function shouldMirrorDisplayTextForSpeech(displayText: string, speechText: string) {
  const displayLanguage = detectDominantMessageLanguage(displayText);
  const speechLanguage = detectDominantMessageLanguage(speechText);

  if (displayLanguage && speechLanguage && displayLanguage !== speechLanguage) {
    return true;
  }

  const comparableDisplayText = normalizeComparableReplyText(displayText);
  const comparableSpeechText = normalizeComparableReplyText(speechText);

  if (!comparableSpeechText) {
    return true;
  }

  return comparableDisplayText !== comparableSpeechText;
}

function normalizeStructuredChatReply(payload: StructuredChatReplyPayload | string): NormalizedStructuredChatReply {
  const displaySource = typeof payload === "string" ? payload : payload.displayText ?? payload.speechText ?? "";
  const speechSource = typeof payload === "string" ? payload : payload.speechText ?? payload.displayText ?? "";
  const displayText = sanitizeUserFacingReply(displaySource);
  const sanitizedSpeechText = sanitizeUserFacingReply(speechSource, { spoken: true }) || displayText;
  const speechText = shouldMirrorDisplayTextForSpeech(displayText, sanitizedSpeechText)
    ? displayText
    : sanitizedSpeechText;

  if (!displayText) {
    throw new Error("LLM did not return a user-facing reply.");
  }

  if (typeof payload === "string") {
    return {
      displayText,
      speechText,
      speechEmotion: "neutral",
    };
  }

  const speechStyle = normalizeSpeechStyle(payload.speechStyle);

  return {
    displayText,
    speechText,
    ...(speechStyle ? { speechStyle } : {}),
    speechEmotion: normalizeSpeechEmotion(payload.speechEmotion, speechStyle),
  };
}

function resolveCompletionMaxTokens(maxTokens?: number) {
  return Math.min(maxTokens ?? 1200, maxNonStreamingCompletionTokens);
}

function resolveRetryMaxTokens(maxTokens: number) {
  return Math.min(maxNonStreamingCompletionTokens, Math.max(maxTokens + 400, Math.ceil(maxTokens * 1.8)));
}

export async function requestOpenAiCompatibleChatCompletion(
  settings: LlmSettings,
  body: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: Record<string, unknown>;
    messages: Array<{
      role: "system" | "assistant" | "user";
      content: string;
    }>;
  },
) {
  const maxTokens = resolveCompletionMaxTokens(body.max_tokens);

  const response = await fetchWithUpstreamErrorContext("LLM API", resolveOpenAiCompatibleUrl(settings.llmUrl, "chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.llmKey}`,
    },
    body: JSON.stringify({
      model: body.model ?? settings.llmModel,
      temperature: body.temperature ?? 0.3,
      max_tokens: maxTokens,
      messages: body.messages,
      ...(body.response_format ? { response_format: body.response_format } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  return (await response.json()) as {
    choices?: Array<{
      finish_reason?: string | null;
      message?: {
        content?: unknown;
      };
    }>;
  };
}

export async function requestOpenAiCompatibleText(
  settings: LlmSettings,
  body: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: Record<string, unknown>;
    messages: Array<{
      role: "system" | "assistant" | "user";
      content: string;
    }>;
  },
) {
  let maxTokens = resolveCompletionMaxTokens(body.max_tokens);
  let lastReply = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const payload = await requestOpenAiCompatibleChatCompletion(settings, {
      ...body,
      max_tokens: maxTokens,
    });
    const reply = extractTextFromContent(payload.choices?.[0]?.message?.content);

    if (!reply) {
      throw new Error("LLM returned an empty response.");
    }

    lastReply = reply;
    const finishReason = normalizeValue(payload.choices?.[0]?.finish_reason).toLowerCase();

    if (finishReason === "length" && maxTokens < maxNonStreamingCompletionTokens) {
      const nextMaxTokens = resolveRetryMaxTokens(maxTokens);

      if (nextMaxTokens > maxTokens) {
        maxTokens = nextMaxTokens;
        continue;
      }
    }

    return reply;
  }

  if (lastReply) {
    return lastReply;
  }

  throw new Error("LLM response could not be completed.");
}

export async function requestOpenAiCompatibleJson<T>(
  settings: LlmSettings,
  body: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    messages: Array<{
      role: "system" | "assistant" | "user";
      content: string;
    }>;
  },
) {
  let reply = "";

  try {
    reply = await requestOpenAiCompatibleText(settings, {
      ...body,
      response_format: { type: "json_object" },
    });
  } catch {
    reply = await requestOpenAiCompatibleText(settings, {
      ...body,
      messages: [
        ...body.messages,
        {
          role: "system",
          content: "Return valid JSON only. Do not wrap the response in markdown fences.",
        },
      ],
    });
  }

  try {
    return JSON.parse(cleanJsonFence(reply)) as T;
  } catch (error) {
    throw new Error(error instanceof Error ? `Failed to parse JSON response: ${error.message}` : "Failed to parse JSON response.");
  }
}

interface FirecrawlSearchResultItem {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
}

export async function searchFirecrawlWeb(
  apiKey: string,
  query: string,
  limit = 3,
) {
  const response = await fetchWithUpstreamErrorContext("Firecrawl search API", "https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      limit,
      sources: ["web"],
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: {
      web?: FirecrawlSearchResultItem[];
    };
  };

  return payload.data?.web ?? [];
}

function buildConversationMessages(
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
): Array<{
  role: "system" | "assistant" | "user";
  content: string;
}> {
  const recentHistory = history.slice(-8).map((message) => ({
    role: (
      message.senderType === "speaker" || message.role === "ai" ? "assistant" : "user"
    ) as "assistant" | "user",
    content:
      message.senderType === "speaker" && message.senderName
        ? `${message.senderName}: ${message.text}`
        : message.text,
  }));

  return [
    {
      role: "system",
      content: buildChatSystemPrompt(podcast),
    },
    ...recentHistory,
    {
      role: "user",
      content: question,
    },
  ];
}

async function requestStructuredChatTurn(
  settings: LlmSettings,
  body: {
    temperature?: number;
    max_tokens?: number;
    messages: Array<{
      role: "system" | "assistant" | "user";
      content: string;
    }>;
  },
) {
  const structuredMessages = injectSystemInstruction(body.messages, buildStructuredReplyInstruction());

  try {
    const payload = await requestOpenAiCompatibleJson<StructuredChatReplyPayload>(settings, {
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      messages: structuredMessages,
    });

    return normalizeStructuredChatReply(payload);
  } catch (initialError) {
    try {
      const fallbackText = await requestOpenAiCompatibleText(settings, {
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        messages: injectSystemInstruction(body.messages, buildPlainReplyFallbackInstruction()),
      });

      return normalizeStructuredChatReply(fallbackText);
    } catch {
      throw initialError;
    }
  }
}

async function requestOpenAiCompatibleChat(
  settings: LlmSettings,
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
) {
  return requestStructuredChatTurn(settings, {
    temperature: 0.6,
    max_tokens: 800,
    messages: buildConversationMessages(podcast, history, question),
  });
}

interface StructuredGroupSpeakerPlanOutput {
  speakerHandles?: string[];
}

function buildMentionContext(mentions: ChatMention[]) {
  if (mentions.length === 0) {
    return "No explicit mentions.";
  }

  return mentions
    .map((mention) =>
      mention.type === "all"
        ? `${mention.handle}: all speakers must reply.`
        : `${mention.handle}: ${mention.name} must reply.`,
    )
    .join("\n");
}

function buildGroupHistoryMessages(history: ChatHistoryMessage[]) {
  return history.slice(-10).map((message) => ({
    role: message.senderType === "speaker" || message.role === "ai" ? "assistant" : "user",
    content:
      message.senderType === "speaker" && message.senderName
        ? `${message.senderName}: ${message.text}`
        : message.text,
  })) as Array<{
    role: "assistant" | "user";
    content: string;
  }>;
}

function getGroupSpeakerProfiles(podcast: Podcast) {
  const speakerById = new Map(podcast.speakers.map((speaker) => [speaker.id, speaker] as const));

  return podcast.speakerProfiles
    .filter((profile) => speakerById.has(profile.speakerId))
    .map((profile) => ({
      ...profile,
      displayName: speakerById.get(profile.speakerId)?.name ?? profile.displayName,
    }));
}

function renderGroupSpeakerProfile(profile: ReturnType<typeof getGroupSpeakerProfiles>[number]) {
  return [
    `${profile.displayName} (${profile.handle})`,
    `Positioning: ${profile.positioning}`,
    `Perspective: ${profile.perspective}`,
    `Speaking style: ${profile.speakingStyle}`,
    profile.grounding.length > 0 ? `Grounding: ${profile.grounding.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPriorTurnReplyContext(replies: ChatReplyMessage[]) {
  if (replies.length === 0) {
    return "No one else has replied in this turn yet.";
  }

  return [
    "Earlier speakers in this same turn already said:",
    ...replies.map((reply) => `${reply.senderName}: ${reply.text}`),
  ].join("\n");
}

function getFallbackSpeakerProfiles(podcast: Podcast) {
  const profiles = getGroupSpeakerProfiles(podcast);
  const aiHostSpeakerId = podcast.aiHostSpeakerId;

  if (!aiHostSpeakerId) {
    return profiles;
  }

  return [...profiles].sort((left, right) => {
    if (left.speakerId === aiHostSpeakerId) {
      return -1;
    }

    if (right.speakerId === aiHostSpeakerId) {
      return 1;
    }

    return 0;
  });
}

function buildGroupSpeakerPlanningMessages(
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
  mentions: ChatMention[],
  broadGroupSolicitation: boolean,
) {
  const speakerProfiles = getGroupSpeakerProfiles(podcast);

  return [
    {
      role: "system" as const,
      content: [
        buildGroupChatSystemPrompt(podcast),
        "You are only deciding which speaker handles should reply next. Do not write any reply text.",
        "Return JSON only with this shape: {\"speakerHandles\":[\"@handle\"]}.",
        "Use only handles from the speaker roster and do not repeat any speaker.",
        broadGroupSolicitation && speakerProfiles.length > 1
          ? "The user is inviting group perspectives, so choose 2 speakers if at least 2 are available."
          : "Prefer a single best speaker unless a second speaker clearly adds value.",
      ].join("\n\n"),
    },
    ...buildGroupHistoryMessages(history),
    {
      role: "user" as const,
      content: [
        `User message: ${question}`,
        `Routing signals:\n${buildMentionContext(mentions)}`,
        `Broad group solicitation: ${broadGroupSolicitation ? "yes" : "no"}`,
      ].join("\n\n"),
    },
  ];
}

function normalizePlannedSpeakerProfiles(
  podcast: Podcast,
  rawHandles: string[] | undefined,
  broadGroupSolicitation: boolean,
) {
  const fallbackProfiles = getFallbackSpeakerProfiles(podcast);
  const profileByHandle = new Map(
    fallbackProfiles.map((profile) => [profile.handle.trim().toLowerCase(), profile] as const),
  );
  const selectedProfiles: typeof fallbackProfiles = [];
  const selectedSpeakerIds = new Set<string>();

  for (const rawHandle of rawHandles ?? []) {
    const normalizedHandle = rawHandle.trim().toLowerCase();
    const profile = profileByHandle.get(normalizedHandle);

    if (!profile || selectedSpeakerIds.has(profile.speakerId)) {
      continue;
    }

    selectedProfiles.push(profile);
    selectedSpeakerIds.add(profile.speakerId);
  }

  const targetCount = broadGroupSolicitation ? Math.min(2, fallbackProfiles.length) : 1;

  for (const profile of fallbackProfiles) {
    if (selectedProfiles.length >= targetCount) {
      break;
    }

    if (selectedSpeakerIds.has(profile.speakerId)) {
      continue;
    }

    selectedProfiles.push(profile);
    selectedSpeakerIds.add(profile.speakerId);
  }

  return selectedProfiles.slice(0, Math.min(2, fallbackProfiles.length));
}

async function requestOrderedGroupSpeakerProfiles(
  settings: LlmSettings,
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
  mentions: ChatMention[],
) {
  const speakerProfiles = getGroupSpeakerProfiles(podcast);
  const explicitSpeakerIds = mentions
    .filter((mention) => mention.type === "speaker")
    .map((mention) => mention.id);

  if (mentions.some((mention) => mention.type === "all")) {
    return speakerProfiles;
  }

  if (explicitSpeakerIds.length > 0) {
    const profileBySpeakerId = new Map(speakerProfiles.map((profile) => [profile.speakerId, profile] as const));

    return explicitSpeakerIds
      .map((speakerId) => profileBySpeakerId.get(speakerId))
      .filter((profile): profile is (typeof speakerProfiles)[number] => Boolean(profile));
  }

  if (speakerProfiles.length <= 1) {
    return speakerProfiles;
  }

  const broadGroupSolicitation = detectBroadGroupSolicitation(question);
  const payload = await requestOpenAiCompatibleJson<StructuredGroupSpeakerPlanOutput>(settings, {
    temperature: 0.4,
    max_tokens: 160,
    messages: buildGroupSpeakerPlanningMessages(
      podcast,
      history,
      question,
      mentions,
      broadGroupSolicitation,
    ),
  });

  return normalizePlannedSpeakerProfiles(podcast, payload.speakerHandles, broadGroupSolicitation);
}

function buildSequentialSpeakerReplyMessages(
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
  mentions: ChatMention[],
  speakerProfile: ReturnType<typeof getGroupSpeakerProfiles>[number],
  priorReplies: ChatReplyMessage[],
  totalSelectedSpeakers: number,
) {
  const explicitSpeakerReply = mentions.some(
    (mention) => mention.type === "speaker" && mention.id === speakerProfile.speakerId,
  );
  const requireAll = mentions.some((mention) => mention.type === "all");
  const brevityInstruction = requireAll
    ? "Keep this reply extra brief because the user explicitly asked everyone to respond."
    : totalSelectedSpeakers > 1
      ? "Keep this reply concise because multiple speakers are sharing this turn."
      : "Keep this reply concise and conversational.";

  return [
    {
      role: "system" as const,
      content: [
        buildGroupChatSystemPrompt(podcast),
        `You are now writing only the next message for ${speakerProfile.displayName} (${speakerProfile.handle}).`,
        `Speaker profile:\n${renderGroupSpeakerProfile(speakerProfile)}`,
        "Write only this speaker's chat message text. Do not prefix the speaker name, do not use quotes, and do not write for any other speaker.",
        explicitSpeakerReply ? "The user directly addressed this speaker, so this speaker must answer." : "",
        brevityInstruction,
        "If earlier speakers in this same turn already replied, read them and then add a distinct next perspective instead of repeating them.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    ...buildGroupHistoryMessages(history),
    {
      role: "user" as const,
      content: [
        `User message: ${question}`,
        `Routing signals:\n${buildMentionContext(mentions)}`,
        buildPriorTurnReplyContext(priorReplies),
        `Reply now only as ${speakerProfile.displayName}.`,
      ].join("\n\n"),
    },
  ];
}

async function requestSequentialSpeakerReply(
  settings: LlmSettings,
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
  mentions: ChatMention[],
  speakerProfile: ReturnType<typeof getGroupSpeakerProfiles>[number],
  priorReplies: ChatReplyMessage[],
  totalSelectedSpeakers: number,
) {
  return requestStructuredChatTurn(settings, {
    temperature: 0.6,
    max_tokens: totalSelectedSpeakers > 1 ? 360 : 520,
    messages: buildSequentialSpeakerReplyMessages(
      podcast,
      history,
      question,
      mentions,
      speakerProfile,
      priorReplies,
      totalSelectedSpeakers,
    ),
  });
}

function buildGroupReplyId(history: ChatHistoryMessage[], speakerId: string, replyIndex: number) {
  return `speaker-${speakerId}-history-${history.length + 1}-reply-${replyIndex}`;
}

async function requestOpenAiCompatibleGroupChat(
  settings: LlmSettings,
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
  mentions: ChatMention[],
) {
  const orderedSpeakerProfiles = await requestOrderedGroupSpeakerProfiles(
    settings,
    podcast,
    history,
    question,
    mentions,
  );
  const replies: ChatReplyMessage[] = [];

  for (const speakerProfile of orderedSpeakerProfiles) {
    const replyPayload = await requestSequentialSpeakerReply(
      settings,
      podcast,
      history,
      question,
      mentions,
      speakerProfile,
      replies,
      orderedSpeakerProfiles.length,
    );

    if (!replyPayload.displayText) {
      continue;
    }

    const replyIndex = replies.length + 1;
    replies.push({
      id: buildGroupReplyId(history, speakerProfile.speakerId, replyIndex),
      senderId: speakerProfile.speakerId,
      senderType: "speaker",
      senderName: speakerProfile.displayName,
      text: replyPayload.displayText,
      ...(replyPayload.speechText ? { speechText: replyPayload.speechText } : {}),
      ...(replyPayload.speechStyle ? { speechStyle: replyPayload.speechStyle } : {}),
      ...(replyPayload.speechEmotion ? { speechEmotion: replyPayload.speechEmotion } : {}),
      mentions: [],
    });
  }

  return replies;
}

export async function generateChatReply(input: {
  podcast: Podcast;
  history: ChatHistoryMessage[];
  question: string;
  mode?: ChatMode;
  mentions?: ChatMention[];
  integrationSettings: LlmSettings;
}): Promise<ChatResponseBody> {
  const { podcast, history, question, integrationSettings } = input;

  if (!isPodcastReady(podcast)) {
    throw new Error("Podcast chat is unavailable until transcript and summaries are ready.");
  }

  if (!hasLlmConfig(integrationSettings)) {
    throw new Error("LLM settings are incomplete. Configure the model before starting chat.");
  }

  const mode = getResolvedChatMode(podcast, input.mode);

  if (mode === "group") {
    const mentions = input.mentions?.length ? input.mentions : parseChatMentions(podcast, question);
    const replies = await requestOpenAiCompatibleGroupChat(
      integrationSettings,
      podcast,
      history,
      question,
      mentions,
    );

    return {
      replies,
      provider: "llm",
      mode,
    };
  }

  const reply = await requestOpenAiCompatibleChat(integrationSettings, podcast, history, question);
  return {
    reply: reply.displayText,
    ...(reply.speechText ? { speechText: reply.speechText } : {}),
    ...(reply.speechStyle ? { speechStyle: reply.speechStyle } : {}),
    ...(reply.speechEmotion ? { speechEmotion: reply.speechEmotion } : {}),
    provider: "llm",
    mode,
  };
}

async function testLlmConnection(settings: IntegrationSettings): Promise<IntegrationTestResponseBody> {
  if (!hasLlmConfig(settings)) {
    return {
      ok: false,
      provider: "llm",
      code: "missing_llm_config",
    };
  }

  await requestOpenAiCompatibleText(settings, {
    temperature: 0,
    max_tokens: 8,
    messages: [
      {
        role: "user",
        content: "Reply with OK.",
      },
    ],
  });

  return {
    ok: true,
    provider: "llm",
    code: "ok_llm",
    model: settings.llmModel,
  };
}

async function testElevenLabsConnection(settings: IntegrationSettings): Promise<IntegrationTestResponseBody> {
  if (!normalizeValue(settings.elevenlabs)) {
    return {
      ok: false,
      provider: "elevenlabs",
      code: "missing_api_key",
    };
  }

  const response = await fetchWithUpstreamErrorContext("ElevenLabs account API", "https://api.elevenlabs.io/v1/user", {
    headers: {
      "xi-api-key": settings.elevenlabs,
    },
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  return {
    ok: true,
    provider: "elevenlabs",
    code: "ok",
  };
}

async function testFirecrawlConnection(settings: IntegrationSettings): Promise<IntegrationTestResponseBody> {
  if (!hasFirecrawlConfig(settings)) {
    return {
      ok: false,
      provider: "firecrawl",
      code: "missing_api_key",
    };
  }

  const response = await fetchWithUpstreamErrorContext("Firecrawl account API", "https://api.firecrawl.dev/v1/team/credit-usage", {
    headers: {
      Authorization: `Bearer ${settings.firecrawl}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const payload = (await response.json()) as {
    data?: {
      remaining_credits?: number;
    };
  };

  return {
    ok: true,
    provider: "firecrawl",
    code: "ok_firecrawl",
    remainingCredits: payload.data?.remaining_credits,
  };
}

export async function testIntegrationConnection(
  provider: IntegrationProvider,
  settings: IntegrationSettings,
): Promise<IntegrationTestResponseBody> {
  try {
    switch (provider) {
      case "elevenlabs":
        return await testElevenLabsConnection(settings);
      case "firecrawl":
        return await testFirecrawlConnection(settings);
      case "llm":
        return await testLlmConnection(settings);
      default:
        return {
          ok: false,
          provider,
          code: "unsupported_provider",
        };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown integration error.";

    return {
      ok: false,
      provider,
      code: "upstream_error",
      detail,
    };
  }
}
