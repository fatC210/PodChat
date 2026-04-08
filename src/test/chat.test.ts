import { describe, expect, it } from "vitest";
import {
  buildChatGreeting,
  buildChatWelcomeMessage,
  buildGroupChatGreeting,
  buildVoiceAgentPrompt,
  buildVoiceReplyLanguageContext,
  detectBroadGroupSolicitation,
  parseChatMentions,
  resolveVoiceAgentLanguage,
} from "@/lib/chat";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Mandarin Test Podcast",
      type: "solo",
      referenceCount: 1,
      sourceFileName: "mandarin.mp3",
      sourceFileSizeMb: 1.2,
      personaPresetId: "analytical",
      personaLocale: "zh",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    }),
    aiHost: "Host",
    topic: "AI",
    guestName: "Guest",
    transcript: [
      {
        id: "line-1",
        speakerId: "speaker-1",
        speaker: "Host",
        color: "text-accent",
        time: "00:00",
        endTime: "00:04",
        text: "Welcome back",
        translation: "\u6b22\u8fce\u56de\u6765",
      },
    ],
  };
}

describe("buildVoiceAgentPrompt", () => {
  it("explicitly follows the latest user language and keeps Chinese voice replies in Mandarin", () => {
    const prompt = buildVoiceAgentPrompt(buildReadyPodcast());

    expect(prompt).toContain("follow the language of the user's latest message");
    expect(prompt).toContain("Mandarin Chinese (Putonghua)");
    expect(prompt).toContain("Do not switch to Cantonese");
    expect(prompt).toContain("If the user's latest message is in English");
    expect(prompt).toContain("Reply in plain text only");
    expect(prompt).toContain('Treat silence or punctuation-only input such as "..." as no input');
  });
});

describe("buildChatGreeting", () => {
  it("uses a Chinese first message without book-title brackets for Chinese podcasts", () => {
    const greeting = buildChatGreeting(buildReadyPodcast());

    expect(greeting).toContain("\u4f60\u521a\u521a\u5728\u542c");
    expect(greeting).toContain("Mandarin Test Podcast");
    expect(greeting).not.toContain("\u300a");
    expect(greeting).not.toContain("\u300b");
  });

  it("lets the UI locale override the podcast-default welcome language", () => {
    const podcast = buildReadyPodcast();

    expect(buildChatGreeting(podcast, "en")).toBe(
      "You were just listening to Mandarin Test Podcast. What should we unpack first?",
    );
    expect(buildChatGreeting(podcast, "zh")).toContain("\u4f60\u521a\u521a\u5728\u542c");
  });

  it("builds a personal welcome message from the AI host", () => {
    expect(buildChatWelcomeMessage(buildReadyPodcast(), "personal")).toEqual({
      senderId: "ai-host",
      senderName: "Host",
      text: buildChatGreeting(buildReadyPodcast()),
    });
  });
});

describe("buildVoiceReplyLanguageContext", () => {
  it("uses Mandarin for plain Chinese user messages", () => {
    expect(buildVoiceReplyLanguageContext("\u4f60\u597d\uff0c\u5e2e\u6211\u603b\u7ed3\u4e00\u4e0b")).toContain("Mandarin Chinese");
  });

  it("switches to English when the user message is in English", () => {
    expect(buildVoiceReplyLanguageContext("Can you recap the key point?")).toContain("Reply in English");
  });

  it("honors an explicit English reply request inside a Chinese message", () => {
    expect(buildVoiceReplyLanguageContext("\u8bf7\u7528\u82f1\u6587\u56de\u7b54\u6211\u8fd9\u4e2a\u95ee\u9898")).toContain("explicitly asked for English");
  });
});

describe("resolveVoiceAgentLanguage", () => {
  it("prefers the detected user language over the podcast default", () => {
    expect(resolveVoiceAgentLanguage(buildReadyPodcast(), "Please answer in English")).toBe("en");
    expect(resolveVoiceAgentLanguage(buildReadyPodcast(), "\u8bf7\u7528\u4e2d\u6587\u56de\u7b54")).toBe("zh");
  });
});

describe("group chat helpers", () => {
  it("parses explicit speaker mentions and @all", () => {
    const podcast: Podcast = {
      ...buildReadyPodcast(),
      type: "multi",
      detectedSpeakerCount: 2,
      speakers: [
        { id: "speaker-1", name: "Host", pct: 60, preview: "Welcome back", duration: "00:10" },
        { id: "speaker-2", name: "Guest", pct: 40, preview: "Key point", duration: "00:08" },
      ],
      speakerProfiles: [
        {
          speakerId: "speaker-1",
          displayName: "Host",
          handle: "@host",
          positioning: "Host profile",
          perspective: "Host view",
          speakingStyle: "Host style",
          grounding: ["Welcome back"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
        {
          speakerId: "speaker-2",
          displayName: "Guest",
          handle: "@guest",
          positioning: "Guest profile",
          perspective: "Guest view",
          speakingStyle: "Guest style",
          grounding: ["Key point"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
      ],
    };

    expect(parseChatMentions(podcast, "Can @guest reply first?")).toEqual([
      {
        id: "speaker-2",
        type: "speaker",
        handle: "@guest",
        name: "Guest",
      },
    ]);
    expect(parseChatMentions(podcast, "@all jump in")).toEqual([
      {
        id: "all",
        type: "all",
        handle: "@all",
        name: "All",
      },
    ]);
  });

  it("treats directly named speakers as routing targets", () => {
    const podcast: Podcast = {
      ...buildReadyPodcast(),
      type: "multi",
      detectedSpeakerCount: 2,
      speakers: [
        { id: "speaker-1", name: "Host", pct: 60, preview: "Welcome back", duration: "00:10" },
        { id: "speaker-2", name: "Guest", pct: 40, preview: "Key point", duration: "00:08" },
      ],
      speakerProfiles: [
        {
          speakerId: "speaker-1",
          displayName: "Host",
          handle: "@host",
          positioning: "Host profile",
          perspective: "Host view",
          speakingStyle: "Host style",
          grounding: ["Welcome back"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
        {
          speakerId: "speaker-2",
          displayName: "Guest",
          handle: "@guest",
          positioning: "Guest profile",
          perspective: "Guest view",
          speakingStyle: "Guest style",
          grounding: ["Key point"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
      ],
    };

    expect(parseChatMentions(podcast, "Guest, what's your take here?")).toEqual([
      {
        id: "speaker-2",
        type: "speaker",
        handle: "@guest",
        name: "Guest",
      },
    ]);
  });

  it("detects broad group solicitations without forcing @all", () => {
    expect(detectBroadGroupSolicitation("你们觉得呢？")).toBe(true);
    expect(detectBroadGroupSolicitation("What do you all think about this?")).toBe(true);
    expect(detectBroadGroupSolicitation("Can you summarize the key point?")).toBe(false);
  });

  it("builds a group greeting that names the members", () => {
    const podcast: Podcast = {
      ...buildReadyPodcast(),
      type: "multi",
      detectedSpeakerCount: 2,
      speakers: [
        { id: "speaker-1", name: "Host", pct: 60, preview: "Welcome back", duration: "00:10" },
        { id: "speaker-2", name: "Guest", pct: 40, preview: "Key point", duration: "00:08" },
      ],
      speakerProfiles: [
        {
          speakerId: "speaker-1",
          displayName: "Host",
          handle: "@host",
          positioning: "Host profile",
          perspective: "Host view",
          speakingStyle: "Host style",
          grounding: ["Welcome back"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
        {
          speakerId: "speaker-2",
          displayName: "Guest",
          handle: "@guest",
          positioning: "Guest profile",
          perspective: "Guest view",
          speakingStyle: "Guest style",
          grounding: ["Key point"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
      ],
    };

    expect(buildGroupChatGreeting(podcast)).toContain("Host");
    expect(buildGroupChatGreeting(podcast)).toContain("Guest");
  });

  it("lets the UI locale override the group greeting language", () => {
    const podcast: Podcast = {
      ...buildReadyPodcast(),
      type: "multi",
      detectedSpeakerCount: 2,
      speakers: [
        { id: "speaker-1", name: "Host", pct: 60, preview: "Welcome back", duration: "00:10" },
        { id: "speaker-2", name: "Guest", pct: 40, preview: "Key point", duration: "00:08" },
      ],
      speakerProfiles: [
        {
          speakerId: "speaker-1",
          displayName: "Host",
          handle: "@host",
          positioning: "Host profile",
          perspective: "Host view",
          speakingStyle: "Host style",
          grounding: ["Welcome back"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
        {
          speakerId: "speaker-2",
          displayName: "Guest",
          handle: "@guest",
          positioning: "Guest profile",
          perspective: "Guest view",
          speakingStyle: "Guest style",
          grounding: ["Key point"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
      ],
    };

    expect(buildGroupChatGreeting(podcast, "en")).toContain("The group chat is live with Host, Guest.");
    expect(buildGroupChatGreeting(podcast, "zh")).toContain("\u7fa4\u804a\u5df2\u5f00");
  });

  it("uses the highest-share speaker for the group welcome message", () => {
    const podcast: Podcast = {
      ...buildReadyPodcast(),
      type: "multi",
      detectedSpeakerCount: 2,
      aiHostSpeakerId: "speaker-1",
      speakers: [
        { id: "speaker-1", name: "Host", pct: 35, preview: "Welcome back", duration: "00:10" },
        { id: "speaker-2", name: "Guest", pct: 65, preview: "Key point", duration: "00:08" },
      ],
      speakerProfiles: [
        {
          speakerId: "speaker-1",
          displayName: "Host",
          handle: "@host",
          positioning: "Host profile",
          perspective: "Host view",
          speakingStyle: "Host style",
          grounding: ["Welcome back"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
        {
          speakerId: "speaker-2",
          displayName: "Guest",
          handle: "@guest",
          positioning: "Guest profile",
          perspective: "Guest view",
          speakingStyle: "Guest style",
          grounding: ["Key point"],
          groupVoiceId: null,
          groupVoiceName: null,
          groupVoiceStatus: "idle",
          groupVoiceError: null,
        },
      ],
    };

    expect(buildChatWelcomeMessage(podcast, "group")).toMatchObject({
      senderId: "speaker-2",
      senderName: "Guest",
      text: buildGroupChatGreeting(podcast),
    });
  });
});
