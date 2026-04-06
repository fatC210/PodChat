import { describe, expect, it } from "vitest";
import {
  buildPodcastFromWizard,
  canRegeneratePodcast,
  getDominantSpeakerId,
  getPreferredAiHostSpeakerId,
  isPodcastReady,
  normalizePodcastSummaries,
  resetPodcastForProcessing,
} from "@/lib/podchat-data";

describe("buildPodcastFromWizard", () => {
  it("creates a configuring podcast without generated mock content", () => {
    const podcast = buildPodcastFromWizard({
      title: "Backend Processed Podcast",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "backend-processed.mp3",
      sourceFileSizeMb: 12.4,
      personaPresetId: "analytical",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    });

    expect(podcast.status).toBe("configuring");
    expect(podcast.workflowStep).toBe("queued");
    expect(podcast.processingProgressPercent).toBe(0);
    expect(podcast.processingError).toBeNull();
    expect(podcast.aiHost).toBeNull();
    expect(podcast.aiHostSpeakerId).toBeNull();
    expect(podcast.aiHostVoiceId).toBeNull();
    expect(podcast.aiHostVoiceName).toBeNull();
    expect(podcast.transcript).toEqual([]);
    expect(podcast.summaries).toEqual([]);
    expect(podcast.scriptChunks).toEqual([]);
    expect(podcast.crawledPages).toEqual([]);
    expect(isPodcastReady(podcast)).toBe(false);
  });

  it("uses localized preset copy when the wizard language is Chinese", () => {
    const podcast = buildPodcastFromWizard({
      title: "中文播客",
      type: "solo",
      referenceCount: 1,
      sourceFileName: "cn.mp3",
      sourceFileSizeMb: 3.2,
      personaPresetId: "analytical",
      personaLocale: "zh",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    });

    expect(podcast.persona.personality).toBe("冷静理性、善于分析、常用数据和类比");
    expect(podcast.persona.catchphrases).toBe("\"让我拆解一下\"、\"数据显示……\"");
    expect(podcast.persona.answerStyle).toBe("定义概念 -> 深入分析 -> 得出结论");
    expect(podcast.persona.languagePref).toBe("使用中文表达，简洁清晰，保留技术语境");
  });

  it("supports custom persona text without choosing a preset", () => {
    const podcast = buildPodcastFromWizard({
      title: "Custom Persona Podcast",
      type: "solo",
      referenceCount: 1,
      sourceFileName: "custom.mp3",
      sourceFileSizeMb: 5.1,
      personaPresetId: "",
      personaLocale: "zh",
      customPersonality: "像朋友一样自然聊天，少一点官话。",
      customCatchphrases: "",
      customAnswerStyle: "",
    });

    expect(podcast.persona.presetId).toBe("");
    expect(podcast.persona.personality).toBe("像朋友一样自然聊天，少一点官话。");
    expect(podcast.persona.catchphrases).toBe("");
    expect(podcast.persona.answerStyle).toBe("");
  });
});

describe("normalizePodcastSummaries", () => {
  it("keeps one shared emotion across durations even when legacy values differ", () => {
    const summaries = normalizePodcastSummaries([
      {
        duration: 1,
        emotion: "enthusiastic",
        text: "Short overview",
      },
      {
        duration: 3,
        emotion: "energetic",
        text: "Slightly more detail",
      },
      {
        duration: 10,
        emotion: "inspirational",
        text: "Most detailed version",
      },
    ]);

    expect(summaries.map((summary) => summary.emotion)).toEqual(["excited", "excited", "excited"]);
  });

  it("falls back to a valid default emotion when the input emotion is unusable", () => {
    const summaries = normalizePodcastSummaries([
      {
        duration: 5,
        emotion: "mysterious",
        text: "Unknown tone label",
      },
    ]);

    expect(summaries[0]?.emotion).toBe("reflective");
  });

  it("converts legacy segment-based summaries into one continuous text block", () => {
    const summaries = normalizePodcastSummaries([
      {
        duration: 3,
        emotion: "reflective",
        segments: [
          { id: "3-1", label: "Background", text: "The episode opens with the main problem." },
          { id: "3-2", label: "Takeaway", text: "It closes on the practical lesson for listeners." },
        ],
      },
    ]);

    expect(summaries[0]?.text).toBe("The episode opens with the main problem. It closes on the practical lesson for listeners.");
  });
});

describe("AI host speaker selection", () => {
  it("falls back to the highest-percentage speaker when no AI host is assigned", () => {
    const speakers = [
      { id: "speaker-1", name: "Speaker 1", pct: 34, preview: "First", duration: "01:20" },
      { id: "speaker-2", name: "Speaker 2", pct: 52, preview: "Second", duration: "02:10" },
      { id: "speaker-3", name: "Speaker 3", pct: 14, preview: "Third", duration: "00:35" },
    ];

    expect(getDominantSpeakerId(speakers)).toBe("speaker-2");
    expect(
      getPreferredAiHostSpeakerId({
        aiHostSpeakerId: null,
        speakers,
      }),
    ).toBe("speaker-2");
  });

  it("preserves an existing AI host speaker selection when it is present", () => {
    const speakers = [
      { id: "speaker-1", name: "Speaker 1", pct: 60, preview: "First", duration: "02:40" },
      { id: "speaker-2", name: "Speaker 2", pct: 40, preview: "Second", duration: "01:45" },
    ];

    expect(
      getPreferredAiHostSpeakerId({
        aiHostSpeakerId: "speaker-2",
        speakers,
      }),
    ).toBe("speaker-2");
  });
});

describe("resetPodcastForProcessing", () => {
  it("clears generated output while preserving the original podcast setup", () => {
    const podcast = buildPodcastFromWizard({
      title: "Regenerate Me",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "regenerate.mp3",
      sourceFileSizeMb: 18.2,
      personaPresetId: "professional",
      personaLocale: "en",
      customPersonality: "Stay practical.",
      customCatchphrases: "",
      customAnswerStyle: "",
    });

    const readyPodcast = {
      ...podcast,
      topic: "Custom topic",
      duration: "12:34",
      aiHost: "Host Alpha",
      aiHostSpeakerId: "speaker-1",
      aiHostVoiceId: "voice-1",
      aiHostVoiceName: "Voice Alpha",
      guestName: "Guest",
      status: "ready" as const,
      processingProgressPercent: 100,
      processingError: "Previous failure",
      progressPercent: 42,
      speakerFilter: "Host Alpha",
      chapters: [{ id: "chapter-1", title: "Intro", time: "00:00" }],
      transcript: [
        {
          id: "line-1",
          speakerId: "speaker-1",
          speaker: "Host Alpha",
          color: "text-accent",
          time: "00:00",
          endTime: "00:05",
          text: "Hello world",
          translation: "你好，世界",
        },
      ],
      speakers: [
        {
          id: "speaker-1",
          name: "Host Alpha",
          pct: 100,
          preview: "Hello world",
          duration: "12:34",
        },
      ],
      scriptChunks: [{ id: 1, text: "Chunk" }],
      crawledPages: [{ id: 1, title: "Page", url: "https://example.com" }],
      summaries: [{ duration: 3, emotion: "reflective" as const, text: "Summary" }],
    };

    const resetPodcast = resetPodcastForProcessing(readyPodcast);

    expect(resetPodcast.title).toBe(readyPodcast.title);
    expect(resetPodcast.sourceFileName).toBe(readyPodcast.sourceFileName);
    expect(resetPodcast.persona).toEqual(readyPodcast.persona);
    expect(resetPodcast.status).toBe("configuring");
    expect(resetPodcast.workflowStep).toBe("queued");
    expect(resetPodcast.processingProgressPercent).toBe(0);
    expect(resetPodcast.processingError).toBeNull();
    expect(resetPodcast.duration).toBe("00:00");
    expect(resetPodcast.aiHost).toBeNull();
    expect(resetPodcast.aiHostSpeakerId).toBeNull();
    expect(resetPodcast.aiHostVoiceId).toBeNull();
    expect(resetPodcast.aiHostVoiceName).toBeNull();
    expect(resetPodcast.guestName).toBe("");
    expect(resetPodcast.progressPercent).toBe(0);
    expect(resetPodcast.speakerFilter).toBeNull();
    expect(resetPodcast.chapters).toEqual([]);
    expect(resetPodcast.transcript).toEqual([]);
    expect(resetPodcast.speakers).toEqual([]);
    expect(resetPodcast.scriptChunks).toEqual([]);
    expect(resetPodcast.crawledPages).toEqual([]);
    expect(resetPodcast.summaries).toEqual([]);
    expect(canRegeneratePodcast(resetPodcast)).toBe(false);
  });
});
