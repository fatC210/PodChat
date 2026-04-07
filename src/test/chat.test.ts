import { describe, expect, it } from "vitest";
import {
  buildChatGreeting,
  buildVoiceAgentPrompt,
  buildVoiceReplyLanguageContext,
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
