import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FloatingChat from "@/components/FloatingChat";
import { buildChatGreeting, buildGroupChatGreeting } from "@/lib/chat";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

const updatePodcastMock = vi.fn();
const requestChatReplyMock = vi.fn();
const requestChatSpeechMock = vi.fn();
const useI18nMock = vi.fn();

vi.mock("@/lib/app-data", () => ({
  useAppData: () => ({
    updatePodcast: updatePodcastMock,
  }),
}));

vi.mock("@/lib/api", () => ({
  prepareGroupVoices: vi.fn().mockResolvedValue({ podcast: null }),
  recloneGroupVoice: vi.fn(),
  requestChatReply: (...args: unknown[]) => requestChatReplyMock(...args),
  requestChatSpeech: (...args: unknown[]) => requestChatSpeechMock(...args),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => useI18nMock(),
}));

const chatTranslations = {
  en: {
    "chat.mode.personal": "Personal",
    "chat.mode.group": "Group",
    "chat.placeholder": "Type your message...",
    "chat.groupPlaceholder": "Send a message, supports @someone and @all",
    "chat.expandAll": "Expand all",
    "chat.collapse": "Collapse",
    "chat.empty.personal": "Start chatting with the current AI host.",
    "chat.empty.group": "Group chat is ready. Send a message or use @someone / @all.",
    "chat.youName": "You",
    "chat.youAvatar": "Y",
    "chat.call.listening.active": "Listening for your reply.",
    "chat.call.textOnly.detail": "This browser does not support continuous voice input.",
    "chat.call.idle.personal": "Start speaking to continue talking with the host.",
    "chat.call.idle.group": "Start speaking to continue the group chat.",
    "chat.call.preparing.detail": "Cloning speaker voices for group chat.",
    "chat.call.generating.detail": "Generating a reply.",
    "chat.call.welcome.detail": "Playing the welcome message.",
    "chat.call.speaking.detail": "The AI is speaking and will stay on standby afterward.",
    "common.send": "Send",
  },
  zh: {
    "chat.mode.personal": "\u4e2a\u4eba",
    "chat.mode.group": "\u7fa4\u804a",
    "chat.placeholder": "\u8f93\u5165\u6d88\u606f...",
    "chat.groupPlaceholder": "\u53d1\u6d88\u606f\uff0c\u652f\u6301 @\u67d0\u4eba \u548c @all",
    "chat.expandAll": "\u5c55\u5f00\u5168\u90e8",
    "chat.collapse": "\u6536\u8d77",
    "chat.empty.personal": "\u5f00\u59cb\u548c\u5f53\u524d AI \u4e3b\u64ad\u804a\u804a\u5427\u3002",
    "chat.empty.group": "\u7fa4\u804a\u5df2\u5c31\u7eea\uff0c\u76f4\u63a5\u53d1\u6d88\u606f\u6216\u4f7f\u7528 @\u67d0\u4eba / @all\u3002",
    "chat.youName": "\u4f60",
    "chat.youAvatar": "\u4f60",
    "chat.call.listening.active": "\u6b63\u5728\u6536\u542c\u4f60\u7684\u56de\u590d",
    "chat.call.textOnly.detail": "\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u8fde\u7eed\u8bed\u97f3\u8f93\u5165\u3002",
    "chat.call.idle.personal": "\u5f00\u53e3\u5373\u53ef\u7ee7\u7eed\u548c\u4e3b\u64ad\u901a\u8bdd\u3002",
    "chat.call.idle.group": "\u5f00\u53e3\u5373\u53ef\u7ee7\u7eed\u7fa4\u804a\u3002",
    "chat.call.preparing.detail": "\u6b63\u5728\u514b\u9686\u7fa4\u804a\u8bf4\u8bdd\u4eba\u7684\u97f3\u8272\u3002",
    "chat.call.generating.detail": "\u6b63\u5728\u751f\u6210\u56de\u590d\u3002",
    "chat.call.welcome.detail": "\u6b63\u5728\u64ad\u62a5\u6b22\u8fce\u8bed\u3002",
    "chat.call.speaking.detail": "AI \u6b63\u5728\u8bf4\u8bdd\uff0c\u7ed3\u675f\u540e\u4f1a\u7ee7\u7eed\u5f85\u547d\u3002",
    "common.send": "\u53d1\u9001",
  },
} as const;

function buildT(lang: keyof typeof chatTranslations) {
  return (key: string, params?: Record<string, string | number>) => {
    let text = chatTranslations[lang][key as keyof (typeof chatTranslations)[typeof lang]] ?? key;

    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value));
      }
    }

    return text;
  };
}

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(window, "webkitSpeechRecognition", {
    configurable: true,
    writable: true,
    value: undefined,
  });
  requestChatSpeechMock.mockResolvedValue(new Blob(["audio"], { type: "audio/mpeg" }));
  useI18nMock.mockReturnValue({
    lang: "zh",
    t: buildT("zh"),
  });
});

function installSpeechRecognitionMock() {
  const startMock = vi.fn();
  const stopMock = vi.fn();
  const instances: Array<{
    onresult: ((event: { results: ArrayLike<{ isFinal?: boolean; 0?: { transcript: string } }> }) => void) | null;
    onerror: ((event: { error?: string }) => void) | null;
    onend: (() => void) | null;
  }> = [];

  class MockSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = "";
    onresult = null;
    onerror = null;
    onend = null;
    constructor() {
      instances.push(this);
    }
    start = vi.fn(() => {
      startMock();
    });
    stop = vi.fn(() => {
      stopMock();
    });
    abort = vi.fn();
  }

  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    writable: true,
    value: MockSpeechRecognition,
  });

  return {
    instances,
    startMock,
    stopMock,
  };
}

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Group UI Podcast",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "group.mp3",
      sourceFileSizeMb: 7.4,
      personaPresetId: "professional",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    }),
    id: "pod-group",
    status: "ready",
    topic: "AI",
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
        text: "Host line",
        translation: "Host line",
      },
    ],
    speakers: [
      { id: "speaker-1", name: "Host", pct: 60, preview: "Host line", duration: "00:10" },
      { id: "speaker-2", name: "Guest", pct: 40, preview: "Guest line", duration: "00:08" },
    ],
    speakerProfiles: [
      {
        speakerId: "speaker-1",
        displayName: "Host",
        handle: "@host",
        positioning: "Host",
        perspective: "Host",
        speakingStyle: "Host",
        grounding: ["Host line"],
        groupVoiceId: "voice-1",
        groupVoiceName: "Voice 1",
        groupVoiceStatus: "ready",
        groupVoiceError: null,
      },
      {
        speakerId: "speaker-2",
        displayName: "Guest",
        handle: "@guest",
        positioning: "Guest",
        perspective: "Guest",
        speakingStyle: "Guest",
        grounding: ["Guest line"],
        groupVoiceId: "voice-2",
        groupVoiceName: "Voice 2",
        groupVoiceStatus: "ready",
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

describe("FloatingChat group mode", () => {
  it("waits for the personal welcome audio before rendering the welcome bubble", async () => {
    const podcast = buildReadyPodcast();
    const greeting = buildChatGreeting(podcast);
    let resolveWelcomeAudio: ((value: Blob) => void) | null = null;

    requestChatSpeechMock.mockReset();
    requestChatSpeechMock.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveWelcomeAudio = resolve;
        }),
    );

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, undefined);
    });

    expect(screen.queryByText(greeting)).not.toBeInTheDocument();

    await act(async () => {
      resolveWelcomeAudio?.(new Blob(["welcome"], { type: "audio/mpeg" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText(greeting)).toBeInTheDocument();
  });

  it("renders the personal welcome as a single spoken chat message instead of header copy", async () => {
    const podcast = buildReadyPodcast();
    const greeting = buildChatGreeting(podcast);

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    expect(await screen.findByText(greeting)).toBeInTheDocument();
    expect(screen.getAllByText(greeting)).toHaveLength(1);
    expect(screen.queryByText("Host")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, undefined);
    });
  });

  it("follows the UI language for the welcome copy and group chat card", async () => {
    const podcast = buildReadyPodcast();
    podcast.targetLang = "zh";
    useI18nMock.mockReturnValue({
      lang: "en",
      t: buildT("en"),
    });

    const greeting = buildChatGreeting(podcast, "en");
    const groupGreeting = buildGroupChatGreeting(podcast, "en");

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    expect(await screen.findByText(greeting)).toBeInTheDocument();

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, undefined);
    });

    fireEvent.click(screen.getByRole("button", { name: "Group" }));

    expect(await screen.findByText(groupGreeting)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Send a message, supports @someone and @all")).toBeInTheDocument();
  });

  it("uses the highest-share speaker when switching into group welcome playback", async () => {
    const podcast = buildReadyPodcast();
    podcast.speakers = [
      { id: "speaker-1", name: "Host", pct: 35, preview: "Host line", duration: "00:10" },
      { id: "speaker-2", name: "Guest", pct: 65, preview: "Guest line", duration: "00:08" },
    ];
    const greeting = buildGroupChatGreeting(podcast);

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalled();
    });
    requestChatSpeechMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "群聊" }));

    expect(await screen.findByText(greeting)).toBeInTheDocument();

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, "speaker-2");
    });
  });

  it("shows mention suggestions in group mode", async () => {
    render(<FloatingChat open onClose={vi.fn()} podcast={buildReadyPodcast()} />);

    fireEvent.click(screen.getByRole("button", { name: "群聊" }));
    fireEvent.change(screen.getByPlaceholderText("发消息，支持 @某人 和 @all"), {
      target: { value: "@g" },
    });

    expect(await screen.findAllByText("@guest")).toHaveLength(2);
  });

  it("clicks a speaker chip to refill the matching @mention", async () => {
    render(<FloatingChat open onClose={vi.fn()} podcast={buildReadyPodcast()} />);

    fireEvent.click(screen.getByRole("button", { name: "群聊" }));
    fireEvent.click(await screen.findByRole("button", { name: /@guest/i }));

    expect(screen.getByPlaceholderText("发消息，支持 @某人 和 @all")).toHaveValue("@guest ");
  });

  it("cancels the personal welcome playback before it starts when switching into group mode", async () => {
    const podcast = buildReadyPodcast();
    const greeting = buildChatGreeting(podcast);
    const groupGreeting = buildGroupChatGreeting(podcast);
    let resolvePersonalWelcome: ((value: Blob) => void) | null = null;

    requestChatSpeechMock.mockReset();
    requestChatSpeechMock.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolvePersonalWelcome = resolve;
        }),
    );
    requestChatSpeechMock.mockResolvedValueOnce(new Blob(["group"], { type: "audio/mpeg" }));

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, undefined);
    });
    expect(screen.queryByText(greeting)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "群聊" }));

    expect(await screen.findByText(groupGreeting)).toBeInTheDocument();

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, groupGreeting, "speaker-1");
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolvePersonalWelcome?.(new Blob(["late-personal"], { type: "audio/mpeg" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText(greeting)).not.toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("shows an expand control when the speaker list overflows two lines", async () => {
    const scrollHeightSpy = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);

    render(<FloatingChat open onClose={vi.fn()} podcast={buildReadyPodcast()} />);

    fireEvent.click(screen.getByRole("button", { name: "群聊" }));

    expect(await screen.findByRole("button", { name: "展开全部" })).toBeInTheDocument();

    scrollHeightSpy.mockRestore();
  });

  it("renders speaker replies returned from the group chat API", async () => {
    requestChatReplyMock.mockResolvedValue({
      mode: "group",
      provider: "llm",
      replies: [
        {
          id: "reply-1",
          senderId: "speaker-2",
          senderType: "speaker",
          senderName: "Guest",
          text: "Guest reply",
          mentions: [],
        },
      ],
    });

    render(<FloatingChat open onClose={vi.fn()} podcast={buildReadyPodcast()} />);

    fireEvent.click(screen.getByRole("button", { name: "群聊" }));
    fireEvent.change(screen.getByPlaceholderText("发消息，支持 @某人 和 @all"), {
      target: { value: "Question for the group" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send|common\.send|\u53d1\u9001/i }));

    await waitFor(() => {
      expect(screen.getByText("Guest reply")).toBeInTheDocument();
    });

    expect(screen.queryByText("Guest")).not.toBeInTheDocument();
  });

  it("waits for reply audio before rendering the AI reply bubble", async () => {
    requestChatReplyMock.mockResolvedValue({
      mode: "personal",
      provider: "llm",
      reply: "Host reply",
    });

    const podcast = buildReadyPodcast();
    const greeting = buildChatGreeting(podcast);
    let resolveReplyAudio: ((value: Blob) => void) | null = null;

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, undefined);
    });

    requestChatSpeechMock.mockClear();
    requestChatSpeechMock.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveReplyAudio = resolve;
        }),
    );

    fireEvent.change(screen.getByPlaceholderText("输入消息..."), {
      target: { value: "Tell me more" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send|common\.send|\u53d1\u9001/i }));

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, "Host reply", undefined);
    });

    expect(screen.getByText("Tell me more")).toBeInTheDocument();
    expect(screen.queryByText("Host reply")).not.toBeInTheDocument();

    await act(async () => {
      resolveReplyAudio?.(new Blob(["reply"], { type: "audio/mpeg" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText("Host reply")).toBeInTheDocument();
  });

  it("shows which speaker is currently replying in the status card", async () => {
    requestChatReplyMock.mockResolvedValue({
      mode: "group",
      provider: "llm",
      replies: [
        {
          id: "reply-1",
          senderId: "speaker-2",
          senderType: "speaker",
          senderName: "Guest",
          text: "Guest reply",
          mentions: [],
        },
      ],
    });

    const podcast = buildReadyPodcast();
    const groupGreeting = buildGroupChatGreeting(podcast);

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    fireEvent.click(screen.getByRole("button", { name: "\u7fa4\u804a" }));

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, groupGreeting, "speaker-1");
    });

    requestChatSpeechMock.mockReset();
    requestChatSpeechMock.mockImplementation(
      () =>
        new Promise<Blob>(() => {
          void 0;
        }),
    );

    fireEvent.change(screen.getByPlaceholderText("\u53d1\u6d88\u606f\uff0c\u652f\u6301 @\u67d0\u4eba \u548c @all"), {
      target: { value: "Question for the group" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send|common\.send|\u53d1\u9001/i }));

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, "Guest reply", "speaker-2");
    });

    expect(await screen.findByText("Guest \u6b63\u5728\u56de\u590d")).toBeInTheDocument();
    expect(screen.queryByText("chat.call.live.badge")).not.toBeInTheDocument();
    expect(screen.queryByText("chat.modeBadge.group")).not.toBeInTheDocument();
  });

  it("keeps hidden speech styling out of the UI while forwarding it to audio playback", async () => {
    requestChatReplyMock.mockResolvedValue({
      mode: "group",
      provider: "llm",
      replies: [
        {
          id: "reply-1",
          senderId: "speaker-2",
          senderType: "speaker",
          senderName: "Guest",
          text: "This episode was about finding an authentic voice in media.",
          speechText: "This episode was about finding an authentic voice in media.",
          speechStyle: "warm, lightly upbeat, conversational",
          speechEmotion: "lighthearted",
          mentions: [],
        },
      ],
    });

    render(<FloatingChat open onClose={vi.fn()} podcast={buildReadyPodcast()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u7fa4\u804a" }));
    fireEvent.change(screen.getByPlaceholderText("\u53d1\u6d88\u606f\uff0c\u652f\u6301 @\u67d0\u4eba \u548c @all"), {
      target: { value: "What was this episode about?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send|common\.send|\u53d1\u9001/i }));

    expect(await screen.findByText("This episode was about finding an authentic voice in media.")).toBeInTheDocument();
    expect(screen.queryByText("warm, lightly upbeat, conversational")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(
        "pod-group",
        "This episode was about finding an authentic voice in media.",
        "speaker-2",
        "lighthearted",
        "warm, lightly upbeat, conversational",
      );
    });
  });

  it("uses the full visible reply for audio when speech text is shorter", async () => {
    const fullReply = "The episode covered product strategy, hiring tradeoffs, and launch timing.";
    requestChatReplyMock.mockResolvedValue({
      mode: "personal",
      provider: "llm",
      reply: fullReply,
      speechText: "The episode covered product strategy.",
    });

    const podcast = buildReadyPodcast();
    const greeting = buildChatGreeting(podcast);

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, undefined);
    });

    requestChatSpeechMock.mockClear();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Tell me everything" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send|common\.send|\u53d1\u9001/i }));

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, fullReply, undefined);
    });

    expect(await screen.findByText(fullReply)).toBeInTheDocument();
  });

  it("keeps showing later replies even if the API reuses a prior reply id", async () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      queueMicrotask(() => {
        this.onended?.(new Event("ended"));
      });
      return Promise.resolve();
    });

    requestChatReplyMock
      .mockResolvedValueOnce({
        mode: "group",
        provider: "llm",
        replies: [
          {
            id: "speaker-speaker-1-history-2-reply-1",
            senderId: "speaker-1",
            senderType: "speaker",
            senderName: "Host",
            text: "First host reply",
            mentions: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: "group",
        provider: "llm",
        replies: [
          {
            id: "speaker-speaker-1-history-2-reply-1",
            senderId: "speaker-1",
            senderType: "speaker",
            senderName: "Host",
            text: "Second host reply",
            mentions: [],
          },
          {
            id: "speaker-speaker-2-history-4-reply-2",
            senderId: "speaker-2",
            senderType: "speaker",
            senderName: "Guest",
            text: "Guest joins in",
            mentions: [],
          },
        ],
      });

    render(<FloatingChat open onClose={vi.fn()} podcast={buildReadyPodcast()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u7fa4\u804a" }));

    fireEvent.change(screen.getByPlaceholderText("\u53d1\u6d88\u606f\uff0c\u652f\u6301 @\u67d0\u4eba \u548c @all"), {
      target: { value: "@host hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send|common\.send|\u53d1\u9001/i }));

    expect(await screen.findByText("First host reply")).toBeInTheDocument();
    await screen.findByText("\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u8fde\u7eed\u8bed\u97f3\u8f93\u5165\u3002");

    fireEvent.change(screen.getByPlaceholderText("\u53d1\u6d88\u606f\uff0c\u652f\u6301 @\u67d0\u4eba \u548c @all"), {
      target: { value: "@all hi again" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send|common\.send|\u53d1\u9001/i }));

    expect(await screen.findByText("Second host reply")).toBeInTheDocument();
    expect(await screen.findByText("Guest joins in")).toBeInTheDocument();

    playSpy.mockRestore();
  });

  it("returns to the green listening standby state after the personal welcome finishes", async () => {
    const { startMock } = installSpeechRecognitionMock();
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      queueMicrotask(() => {
        this.onended?.(new Event("ended"));
      });
      return Promise.resolve();
    });
    const podcast = buildReadyPodcast();
    const greeting = buildChatGreeting(podcast);

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, greeting, undefined);
    });

    const listeningLabel = await screen.findByText("\u6b63\u5728\u6536\u542c\u4f60\u7684\u56de\u590d");
    expect(listeningLabel.previousElementSibling).toHaveAttribute("data-call-state", "listening");
    expect(startMock).toHaveBeenCalled();

    playSpy.mockRestore();
  });

  it("uses the same listening standby state after the group welcome finishes", async () => {
    const { startMock, stopMock } = installSpeechRecognitionMock();
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      queueMicrotask(() => {
        this.onended?.(new Event("ended"));
      });
      return Promise.resolve();
    });
    const podcast = buildReadyPodcast();
    const groupGreeting = buildGroupChatGreeting(podcast);

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    await screen.findByText("\u6b63\u5728\u6536\u542c\u4f60\u7684\u56de\u590d");
    fireEvent.click(screen.getByRole("button", { name: "\u7fa4\u804a" }));

    await waitFor(() => {
      expect(requestChatSpeechMock).toHaveBeenCalledWith(podcast.id, groupGreeting, "speaker-1");
    });

    const listeningLabel = await screen.findByText("\u6b63\u5728\u6536\u542c\u4f60\u7684\u56de\u590d");
    expect(listeningLabel.previousElementSibling).toHaveAttribute("data-call-state", "listening");
    expect(startMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(stopMock).toHaveBeenCalled();

    playSpy.mockRestore();
  });

  it("keeps the listening waveform blue for ignored speech-recognition events", async () => {
    const { instances } = installSpeechRecognitionMock();
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      queueMicrotask(() => {
        this.onended?.(new Event("ended"));
      });
      return Promise.resolve();
    });
    const podcast = buildReadyPodcast();

    render(<FloatingChat open onClose={vi.fn()} podcast={podcast} />);

    const listeningLabel = await screen.findByText("\u6b63\u5728\u6536\u542c\u4f60\u7684\u56de\u590d");
    expect(listeningLabel.previousElementSibling).toHaveAttribute("data-call-state", "listening");

    const initialRecognition = instances.at(-1);
    expect(initialRecognition).toBeTruthy();

    act(() => {
      initialRecognition?.onerror?.({ error: "no-speech" });
    });

    const listeningAfterSilence = await screen.findByText("\u6b63\u5728\u6536\u542c\u4f60\u7684\u56de\u590d");
    expect(listeningAfterSilence.previousElementSibling).toHaveAttribute("data-call-state", "listening");
    expect(screen.queryByText("no-speech")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "\u7fa4\u804a" }));

    await waitFor(() => {
      expect(instances.length).toBeGreaterThan(1);
    });

    act(() => {
      initialRecognition?.onerror?.({ error: "aborted" });
    });

    const listeningAfterAbort = await screen.findByText("\u6b63\u5728\u6536\u542c\u4f60\u7684\u56de\u590d");
    expect(listeningAfterAbort.previousElementSibling).toHaveAttribute("data-call-state", "listening");
    expect(screen.queryByText("aborted")).not.toBeInTheDocument();

    playSpy.mockRestore();
  });
});
