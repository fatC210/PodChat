import {
  buildChatSystemPrompt,
  type ChatHistoryMessage,
  type ChatResponseBody,
  type IntegrationProvider,
  type IntegrationTestResponseBody,
} from "@/lib/chat";
import { isPodcastReady, type IntegrationSettings, type Podcast } from "@/lib/podchat-data";

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
    const data = (await response.json()) as UpstreamErrorPayload;

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
  const maxTokens = Math.min(body.max_tokens ?? 1200, maxNonStreamingCompletionTokens);

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
  const payload = await requestOpenAiCompatibleChatCompletion(settings, body);
  const reply = extractTextFromContent(payload.choices?.[0]?.message?.content);

  if (!reply) {
    throw new Error("LLM returned an empty response.");
  }

  return reply;
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
    role: (message.role === "ai" ? "assistant" : "user") as "assistant" | "user",
    content: message.text,
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

async function requestOpenAiCompatibleChat(
  settings: LlmSettings,
  podcast: Podcast,
  history: ChatHistoryMessage[],
  question: string,
) {
  return requestOpenAiCompatibleText(settings, {
    temperature: 0.6,
    max_tokens: 400,
    messages: buildConversationMessages(podcast, history, question),
  });
}

export async function generateChatReply(input: {
  podcast: Podcast;
  history: ChatHistoryMessage[];
  question: string;
  integrationSettings: LlmSettings;
}): Promise<ChatResponseBody> {
  const { podcast, history, question, integrationSettings } = input;

  if (!isPodcastReady(podcast)) {
    throw new Error("Podcast chat is unavailable until transcript and summaries are ready.");
  }

  if (!hasLlmConfig(integrationSettings)) {
    throw new Error("LLM settings are incomplete. Configure the model before starting chat.");
  }

  const reply = await requestOpenAiCompatibleChat(integrationSettings, podcast, history, question);
  return {
    reply,
    provider: "llm",
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
