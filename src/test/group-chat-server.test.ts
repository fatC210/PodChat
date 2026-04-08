// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { generateChatReply } from "@/lib/server/integrations";
import { parseChatMentions } from "@/lib/chat";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Group Chat Podcast",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "group.mp3",
      sourceFileSizeMb: 9.3,
      personaPresetId: "professional",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    }),
    status: "ready",
    topic: "AI workflows",
    aiHost: "Host",
    aiHostSpeakerId: "speaker-1",
    guestName: "Guest",
    detectedSpeakerCount: 2,
    transcript: [
      {
        id: "line-1",
        speakerId: "speaker-1",
        speaker: "Host",
        color: "text-accent",
        time: "00:00",
        endTime: "00:04",
        text: "Host perspective",
        translation: "Host perspective",
      },
      {
        id: "line-2",
        speakerId: "speaker-2",
        speaker: "Guest",
        color: "text-info",
        time: "00:04",
        endTime: "00:08",
        text: "Guest perspective",
        translation: "Guest perspective",
      },
    ],
    speakers: [
      { id: "speaker-1", name: "Host", pct: 55, preview: "Host perspective", duration: "00:04" },
      { id: "speaker-2", name: "Guest", pct: 45, preview: "Guest perspective", duration: "00:04" },
    ],
    speakerProfiles: [
      {
        speakerId: "speaker-1",
        displayName: "Host",
        handle: "@host",
        positioning: "Host positioning",
        perspective: "Host perspective",
        speakingStyle: "Host style",
        grounding: ["Host perspective"],
        groupVoiceId: null,
        groupVoiceName: null,
        groupVoiceStatus: "idle",
        groupVoiceError: null,
      },
      {
        speakerId: "speaker-2",
        displayName: "Guest",
        handle: "@guest",
        positioning: "Guest positioning",
        perspective: "Guest perspective",
        speakingStyle: "Guest style",
        grounding: ["Guest perspective"],
        groupVoiceId: null,
        groupVoiceName: null,
        groupVoiceStatus: "idle",
        groupVoiceError: null,
      },
    ],
    summaries: [
      {
        duration: 1,
        emotion: "reflective",
        text: "Summary",
      },
    ],
  };
}

function buildChatCompletionResponse(content: string) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content,
          },
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

type MockChatCompletionInput =
  | string
  | Record<string, unknown>
  | {
      content: string | Record<string, unknown>;
      finishReason?: string | null;
    };

function mockChatCompletions(...contents: MockChatCompletionInput[]) {
  const fetchMock = vi.spyOn(global, "fetch");

  for (const entry of contents) {
    const normalizedEntry =
      typeof entry === "string"
        ? { content: entry, finishReason: "stop" }
        : "content" in entry || "finishReason" in entry
          ? {
              content: entry.content,
              finishReason: entry.finishReason ?? "stop",
            }
          : { content: entry, finishReason: "stop" };

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: normalizedEntry.finishReason,
              message: {
                content:
                  typeof normalizedEntry.content === "string"
                    ? normalizedEntry.content
                    : JSON.stringify(normalizedEntry.content),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }

  return fetchMock;
}

function readRequestMessages(fetchMock: ReturnType<typeof mockChatCompletions>, callIndex: number) {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  const payload = JSON.parse(String(init?.body ?? "{}")) as {
    messages?: Array<{ content?: string }>;
  };

  return payload.messages ?? [];
}

describe("generateChatReply group mode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forces a directly named speaker to answer", async () => {
    const podcast = buildReadyPodcast();
    const fetchMock = mockChatCompletions({
      displayText: "Guest reply",
      speechText: "Guest reply",
      speechStyle: "warm and concise",
      speechEmotion: "lighthearted",
    });
    const question = "Guest, what do you think?";

    const response = await generateChatReply({
      podcast,
      history: [],
      question,
      mode: "group",
      mentions: parseChatMentions(podcast, question),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.mode).toBe("group");
    expect(response.replies).toEqual([
      expect.objectContaining({
        senderId: "speaker-2",
        senderName: "Guest",
        text: "Guest reply",
        speechText: "Guest reply",
        speechStyle: "warm and concise",
        speechEmotion: "lighthearted",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps speech text aligned with a Chinese group reply when the model emits English TTS text", async () => {
    const podcast = buildReadyPodcast();
    const question = "@guest 你也来打个招呼吧";
    const fetchMock = mockChatCompletions({
      displayText: "你好！我也很高兴加入这场对话，感觉今天会聊得很尽兴。",
      speechText: "Hello! I'm also excited to join this conversation, and I think this will be a great discussion.",
      speechStyle: "warm and concise",
      speechEmotion: "lighthearted",
    });

    const response = await generateChatReply({
      podcast,
      history: [],
      question,
      mode: "group",
      mentions: parseChatMentions(podcast, question),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.replies).toEqual([
      expect.objectContaining({
        senderId: "speaker-2",
        text: "你好！我也很高兴加入这场对话，感觉今天会聊得很尽兴。",
        speechText: "你好！我也很高兴加入这场对话，感觉今天会聊得很尽兴。",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("plans multiple ordered speakers for broad group asks and threads earlier replies into later prompts", async () => {
    const podcast = buildReadyPodcast();
    const fetchMock = mockChatCompletions(
      { speakerHandles: ["@host", "@guest"] },
      {
        displayText: "I think the first issue is adoption.",
        speechText: "I think the first issue is adoption.",
        speechStyle: "measured and confident",
        speechEmotion: "serious",
      },
      {
        displayText: "Building on Host, reliability is the part I would watch next.",
        speechText: "Building on Host, reliability is the part I would watch next.",
        speechStyle: "thoughtful and steady",
        speechEmotion: "reflective",
      },
    );
    const question = "What do you all think about this workflow?";

    const response = await generateChatReply({
      podcast,
      history: [],
      question,
      mode: "group",
      mentions: parseChatMentions(podcast, question),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.replies?.map((reply) => reply.senderName)).toEqual(["Host", "Guest"]);
    expect(response.replies?.map((reply) => reply.text)).toEqual([
      "I think the first issue is adoption.",
      "Building on Host, reliability is the part I would watch next.",
    ]);

    const thirdCallMessages = readRequestMessages(fetchMock, 2).map((message) => message.content ?? "");
    expect(thirdCallMessages.join("\n")).toContain("Earlier speakers in this same turn already said:");
    expect(thirdCallMessages.join("\n")).toContain("Host: I think the first issue is adoption.");
  });

  it("keeps every speaker replying when @all is used", async () => {
    const podcast = buildReadyPodcast();
    const fetchMock = mockChatCompletions(
      {
        displayText: "Host reply",
        speechText: "Host reply",
        speechStyle: "brief and upbeat",
        speechEmotion: "excited",
      },
      {
        displayText: "Guest reply",
        speechText: "Guest reply",
        speechStyle: "brief and warm",
        speechEmotion: "lighthearted",
      },
    );

    const response = await generateChatReply({
      podcast,
      history: [],
      question: "@all weigh in",
      mode: "group",
      mentions: parseChatMentions(podcast, "@all weigh in"),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.replies?.map((reply) => reply.senderName)).toEqual(["Host", "Guest"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns unique reply ids across separate group turns", async () => {
    const podcast = buildReadyPodcast();
    mockChatCompletions(
      {
        displayText: "Host reply",
        speechText: "Host reply",
        speechStyle: "brief and upbeat",
        speechEmotion: "excited",
      },
      {
        displayText: "Host follow-up",
        speechText: "Host follow-up",
        speechStyle: "brief and upbeat",
        speechEmotion: "excited",
      },
      {
        displayText: "Guest follow-up",
        speechText: "Guest follow-up",
        speechStyle: "brief and warm",
        speechEmotion: "lighthearted",
      },
    );

    const firstQuestion = "Host, say hi";
    const firstResponse = await generateChatReply({
      podcast,
      history: [
        {
          id: "user-1",
          senderId: "user",
          senderType: "user",
          senderName: "You",
          text: firstQuestion,
        },
      ],
      question: firstQuestion,
      mode: "group",
      mentions: parseChatMentions(podcast, firstQuestion),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    const secondQuestion = "@all say hi again";
    const secondResponse = await generateChatReply({
      podcast,
      history: [
        {
          id: "user-1",
          senderId: "user",
          senderType: "user",
          senderName: "You",
          text: firstQuestion,
        },
        ...(firstResponse.replies ?? []).map((reply) => ({
          id: reply.id,
          senderId: reply.senderId,
          senderType: reply.senderType,
          senderName: reply.senderName,
          text: reply.text,
        })),
        {
          id: "user-2",
          senderId: "user",
          senderType: "user",
          senderName: "You",
          text: secondQuestion,
        },
      ],
      question: secondQuestion,
      mode: "group",
      mentions: parseChatMentions(podcast, secondQuestion),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(firstResponse.replies).toHaveLength(1);
    expect(secondResponse.replies?.map((reply) => reply.senderName)).toEqual(["Host", "Guest"]);
    expect(secondResponse.replies?.[0]?.id).not.toBe(firstResponse.replies?.[0]?.id);
    expect(new Set(secondResponse.replies?.map((reply) => reply.id))).toHaveLength(secondResponse.replies?.length ?? 0);
  });

  it("extracts only the final visible reply when the model leaks internal notes", async () => {
    const podcast = buildReadyPodcast();
    const leakedOutput =
      'The user is asking "What was this podcast about?" and I need to reply as Speaker 2. Looking at the context, I should keep it upbeat. Draft response: "It was about finding your authentic voice in media, including Nimi Mehta\'s career turns and what self-discovery looked like along the way."';
    const fetchMock = mockChatCompletions(leakedOutput, leakedOutput);

    const response = await generateChatReply({
      podcast,
      history: [],
      question: "Guest, what was this podcast about?",
      mode: "group",
      mentions: parseChatMentions(podcast, "Guest, what was this podcast about?"),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.replies).toEqual([
      expect.objectContaining({
        senderId: "speaker-2",
        text: "It was about finding your authentic voice in media, including Nimi Mehta's career turns and what self-discovery looked like along the way.",
        speechText:
          "It was about finding your authentic voice in media, including Nimi Mehta's career turns and what self-discovery looked like along the way.",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("strips markdown formatting out of visible and spoken replies", async () => {
    const podcast = buildReadyPodcast();
    const fetchMock = mockChatCompletions({
      displayText: "## Summary\n- **First** takeaway\n- Visit [the notes](https://example.com)\n- Use `plain text`",
      speechText: "## Summary\n- **First** takeaway\n- Visit [the notes](https://example.com)\n- Use `plain text`",
      speechStyle: "warm and concise",
      speechEmotion: "lighthearted",
    });

    const response = await generateChatReply({
      podcast,
      history: [],
      question: "Guest, recap this for me.",
      mode: "group",
      mentions: parseChatMentions(podcast, "Guest, recap this for me."),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.replies).toEqual([
      expect.objectContaining({
        senderId: "speaker-2",
        text: "Summary\nFirst takeaway\nVisit the notes\nUse plain text",
        speechText: "Summary First takeaway Visit the notes Use plain text",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the full visible reply when speech text omits content", async () => {
    const podcast = buildReadyPodcast();
    const fetchMock = mockChatCompletions({
      displayText: "It covered product strategy, hiring tradeoffs, and launch timing.",
      speechText: "It covered product strategy.",
      speechStyle: "measured and clear",
      speechEmotion: "serious",
    });

    const response = await generateChatReply({
      podcast,
      history: [],
      question: "Guest, what did this episode cover?",
      mode: "group",
      mentions: parseChatMentions(podcast, "Guest, what did this episode cover?"),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.replies).toEqual([
      expect.objectContaining({
        senderId: "speaker-2",
        text: "It covered product strategy, hiring tradeoffs, and launch timing.",
        speechText: "It covered product strategy, hiring tradeoffs, and launch timing.",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries with a larger token budget when the upstream reply is cut off", async () => {
    const podcast = buildReadyPodcast();
    const fetchMock = mockChatCompletions(
      {
        content: '{"displayText":"This reply was cut off',
        finishReason: "length",
      },
      {
        displayText: "This reply is complete after retrying with a larger limit.",
        speechText: "This reply is complete after retrying with a larger limit.",
        speechStyle: "steady and clear",
        speechEmotion: "neutral",
      },
    );

    const response = await generateChatReply({
      podcast,
      history: [],
      question: "Guest, give me the full answer.",
      mode: "group",
      mentions: parseChatMentions(podcast, "Guest, give me the full answer."),
      integrationSettings: {
        llmKey: "key",
        llmUrl: "https://example.com/v1",
        llmModel: "model",
      },
    });

    expect(response.replies).toEqual([
      expect.objectContaining({
        senderId: "speaker-2",
        text: "This reply is complete after retrying with a larger limit.",
        speechText: "This reply is complete after retrying with a larger limit.",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? "{}")) as {
      max_tokens?: number;
    };
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.body ?? "{}")) as {
      max_tokens?: number;
    };

    expect(secondBody.max_tokens).toBeGreaterThan(firstBody.max_tokens ?? 0);
  });
});
