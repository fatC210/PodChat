export type PodcastStatus = "ready" | "configuring";
export type PodcastType = "solo" | "multi";
export const summaryEmotions = ["lighthearted", "serious", "excited", "reflective", "humorous"] as const;
export type SummaryEmotion = (typeof summaryEmotions)[number];
export type TranscriptMode = "original" | "translated" | "trans-top" | "trans-bottom";
export type PodcastWorkflowStep =
  | "upload"
  | "type"
  | "persona"
  | "review"
  | "queued"
  | "transcribing"
  | "summarizing"
  | "knowledge"
  | "finalizing";

const setupWorkflowSteps: PodcastWorkflowStep[] = ["upload", "type", "persona", "review"];
const processingWorkflowSteps: PodcastWorkflowStep[] = [
  "queued",
  "transcribing",
  "summarizing",
  "knowledge",
  "finalizing",
];

export interface SpeakerSample {
  id: string;
  name: string;
  pct: number;
  preview: string;
  duration: string;
}

export type GroupVoiceStatus = "idle" | "preparing" | "ready" | "failed";

export interface SpeakerProfile {
  speakerId: string;
  displayName: string;
  handle: string;
  positioning: string;
  perspective: string;
  speakingStyle: string;
  grounding: string[];
  groupVoiceId: string | null;
  groupVoiceName: string | null;
  groupVoiceStatus: GroupVoiceStatus;
  groupVoiceError: string | null;
}

export interface Chapter {
  id: string;
  title: string;
  time: string;
}

export interface TranscriptLine {
  id: string;
  speakerId?: string;
  speaker: string;
  color: string;
  time: string;
  endTime?: string;
  text: string;
  translation: string;
  translations?: Record<string, string>;
}

export interface ScriptChunk {
  id: number;
  text: string;
}

export interface CrawledPage {
  id: number;
  title: string;
  url: string;
  excerpt?: string;
  matchedTerms?: string[];
  reason?: string;
}

export interface PersonaSettings {
  presetId: string;
  personality: string;
  catchphrases: string;
  answerStyle: string;
  languagePref: string;
  customPersonality: string;
  customCatchphrases: string;
  customAnswerStyle: string;
}

export type PersonaLocale = "en" | "zh";

export interface PodcastSummary {
  duration: number;
  emotion: SummaryEmotion;
  text: string;
  translations?: Record<string, string>;
}

interface SummarySegmentInput {
  id?: string;
  label?: string;
  text?: string | null;
}

export interface PodcastSummaryInput {
  duration: number;
  emotion?: string | null;
  text?: string | null;
  segments?: SummarySegmentInput[] | null;
  translations?: Record<string, string | null | undefined> | null;
}

export interface Podcast {
  id: string;
  title: string;
  topic: string;
  duration: string;
  createdAt: string;
  aiHost: string | null;
  aiHostSpeakerId: string | null;
  aiHostVoiceId: string | null;
  aiHostVoiceName: string | null;
  guestName: string;
  status: PodcastStatus;
  color: string;
  type: PodcastType;
  referenceCount: number;
  sourceFileName: string;
  sourceFileSizeMb: number;
  workflowStep?: PodcastWorkflowStep;
  processingProgressPercent: number;
  processingError?: string | null;
  wizardStep?: number;
  progressPercent: number;
  speed: number;
  transcriptMode: TranscriptMode;
  targetLang: string;
  speakerFilter: string | null;
  detectedSpeakerCount: number;
  chapters: Chapter[];
  transcript: TranscriptLine[];
  speakers: SpeakerSample[];
  speakerProfiles: SpeakerProfile[];
  scriptChunks: ScriptChunk[];
  crawledPages: CrawledPage[];
  persona: PersonaSettings;
  summaries: PodcastSummary[];
}

export interface IntegrationSettings {
  elevenlabs: string;
  elevenlabsVoiceId: string;
  elevenlabsAgentId: string;
  firecrawl: string;
  llmKey: string;
  llmUrl: string;
  llmModel: string;
}

export interface SavePodcastInput {
  draftId?: string;
  title: string;
  type: PodcastType;
  referenceCount: number;
  hostId?: string;
  sourceFileName: string;
  sourceFileSizeMb: number;
  personaPresetId: string;
  personaLocale: PersonaLocale;
  customPersonality: string;
  customCatchphrases: string;
  customAnswerStyle: string;
}

export interface PersonaPreset {
  id: string;
  labelKey: string;
  personality: { en: string; zh: string };
  catchphrases: { en: string; zh: string };
  answerStyle: { en: string; zh: string };
}

export interface AppDataState {
  podcasts: Podcast[];
  integrationSettings: IntegrationSettings;
}

export const clientPodcastStateFields = [
  "progressPercent",
  "speed",
  "transcriptMode",
  "targetLang",
  "speakerFilter",
] as const;

export type ClientPodcastState = Pick<Podcast, (typeof clientPodcastStateFields)[number]>;

const colorChoices = [
  "from-primary/15 to-accent/10",
  "from-accent/15 to-primary/10",
  "from-info/15 to-accent/10",
  "from-warning/15 to-primary/10",
];

const topicPresets = [
  {
    keyword: "quantum",
    topic: "quantum computing",
  },
  {
    keyword: "climate",
    topic: "climate innovation",
  },
  {
    keyword: "design",
    topic: "product design",
  },
];

export const summaryDurations = [1, 3, 5, 10] as const;

export const targetLangs = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
] as const;

function slugifySpeakerHandleSegment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "speaker";
}

export function buildSpeakerHandle(name: string, existingHandles?: Set<string>) {
  const base = slugifySpeakerHandleSegment(name.replace(/^@+/, ""));
  const usedHandles = existingHandles ?? new Set<string>();
  let candidate = `@${base}`;
  let suffix = 2;

  while (usedHandles.has(candidate)) {
    candidate = `@${base}-${suffix}`;
    suffix += 1;
  }

  usedHandles.add(candidate);
  return candidate;
}

function buildDefaultSpeakerProfile(input: {
  speaker: SpeakerSample;
  transcriptPreview: string;
  handle: string;
}): SpeakerProfile {
  const { speaker, transcriptPreview, handle } = input;

  return {
    speakerId: speaker.id,
    displayName: speaker.name,
    handle,
    positioning: `${speaker.name} is one of the podcast speakers and should stay grounded in the recorded discussion.`,
    perspective: transcriptPreview || `${speaker.name} should respond using their own perspective from the podcast transcript.`,
    speakingStyle: `Keep the tone aligned with ${speaker.name}'s transcript phrasing and pacing.`,
    grounding: transcriptPreview ? [transcriptPreview] : [],
    groupVoiceId: null,
    groupVoiceName: null,
    groupVoiceStatus: "idle",
    groupVoiceError: null,
  };
}

export function normalizeSpeakerProfiles(
  speakers: SpeakerSample[],
  transcript: TranscriptLine[],
  speakerProfiles?: SpeakerProfile[] | null,
) {
  const transcriptPreviewBySpeakerId = new Map<string, string>();

  transcript.forEach((line) => {
    const speakerId = line.speakerId?.trim();

    if (!speakerId || transcriptPreviewBySpeakerId.has(speakerId)) {
      return;
    }

    transcriptPreviewBySpeakerId.set(speakerId, line.text.trim());
  });

  const profileBySpeakerId = new Map(
    (speakerProfiles ?? [])
      .filter((profile) => Boolean(profile.speakerId))
      .map((profile) => [profile.speakerId, profile] as const),
  );
  const usedHandles = new Set<string>();

  return speakers.map((speaker) => {
    const existingProfile = profileBySpeakerId.get(speaker.id);
    const transcriptPreview = transcriptPreviewBySpeakerId.get(speaker.id) ?? speaker.preview;
    const nextHandle = buildSpeakerHandle(speaker.name, usedHandles);

    return {
      ...(existingProfile ??
        buildDefaultSpeakerProfile({
          speaker,
          transcriptPreview,
          handle: nextHandle,
        })),
      speakerId: speaker.id,
      displayName: speaker.name,
      handle: nextHandle,
      positioning:
        existingProfile?.positioning?.trim() ||
        `${speaker.name} is one of the podcast speakers and should stay grounded in the recorded discussion.`,
      perspective:
        existingProfile?.perspective?.trim() ||
        transcriptPreview ||
        `${speaker.name} should respond using their own perspective from the podcast transcript.`,
      speakingStyle:
        existingProfile?.speakingStyle?.trim() ||
        `Keep the tone aligned with ${speaker.name}'s transcript phrasing and pacing.`,
      grounding:
        existingProfile?.grounding?.filter(Boolean).length
          ? existingProfile.grounding.filter(Boolean)
          : [transcriptPreview].filter(Boolean),
      groupVoiceId: existingProfile?.groupVoiceId ?? null,
      groupVoiceName: existingProfile?.groupVoiceName ?? null,
      groupVoiceStatus: existingProfile?.groupVoiceStatus ?? "idle",
      groupVoiceError: existingProfile?.groupVoiceError ?? null,
    } satisfies SpeakerProfile;
  });
}

function normalizeTextTranslations(
  translations: Record<string, string | null | undefined> | null | undefined,
) {
  return Object.fromEntries(
    Object.entries(translations ?? {})
      .map(([lang, text]) => [lang.trim().toLowerCase(), text?.trim() ?? ""] as const)
      .filter(([lang, text]) => Boolean(lang && text)),
  );
}

function hasCjkCharacters(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function hasLegacyZhTranscriptTranslation(line: Pick<TranscriptLine, "text" | "translation">) {
  const normalizedText = line.text.trim();
  const normalizedTranslation = line.translation.trim();

  if (!normalizedTranslation) {
    return false;
  }

  if (normalizedTranslation !== normalizedText) {
    return true;
  }

  return hasCjkCharacters(normalizedText);
}

export function normalizeTranscriptLines(transcript: TranscriptLine[]) {
  return transcript.map((line) => {
    const text = line.text.trim();
    const normalizedTranslations = normalizeTextTranslations(line.translations);
    const legacyTranslation = line.translation.trim();

    if (hasLegacyZhTranscriptTranslation({ text, translation: legacyTranslation }) && !normalizedTranslations.zh) {
      normalizedTranslations.zh = legacyTranslation;
    }

    return {
      ...line,
      text,
      translation: legacyTranslation || normalizedTranslations.zh || text,
      translations: Object.keys(normalizedTranslations).length > 0 ? normalizedTranslations : undefined,
    } satisfies TranscriptLine;
  });
}

export function isSupportedTargetLang(targetLang: string | null | undefined) {
  const normalizedTargetLang = targetLang?.trim().toLowerCase();

  return Boolean(
    normalizedTargetLang &&
      targetLangs.some((lang) => lang.code === normalizedTargetLang),
  );
}

export function getTargetLangLabel(targetLang: string) {
  const normalizedTargetLang = targetLang.trim().toLowerCase();
  return targetLangs.find((lang) => lang.code === normalizedTargetLang)?.label ?? normalizedTargetLang.toUpperCase();
}

export function getSummaryTranslation(summary: PodcastSummary, targetLang: string | null | undefined) {
  const normalizedTargetLang = targetLang?.trim().toLowerCase();

  if (!normalizedTargetLang) {
    return null;
  }

  return summary.translations?.[normalizedTargetLang]?.trim() || null;
}

export function upsertSummaryTranslation(
  summary: PodcastSummary,
  targetLang: string,
  translatedText: string,
): PodcastSummary {
  const normalizedTargetLang = targetLang.trim().toLowerCase();
  const normalizedText = translatedText.trim();

  if (!normalizedTargetLang || !normalizedText) {
    return summary;
  }

  return {
    ...summary,
    translations: {
      ...(summary.translations ?? {}),
      [normalizedTargetLang]: normalizedText,
    },
  };
}

export function getTranscriptTranslation(line: TranscriptLine, targetLang: string | null | undefined) {
  const normalizedTargetLang = targetLang?.trim().toLowerCase();

  if (!normalizedTargetLang) {
    return null;
  }

  const directTranslation = line.translations?.[normalizedTargetLang]?.trim();

  if (directTranslation) {
    return directTranslation;
  }

  if (normalizedTargetLang === "zh" && hasLegacyZhTranscriptTranslation(line)) {
    return line.translation.trim();
  }

  return null;
}

export function upsertTranscriptTranslation(
  line: TranscriptLine,
  targetLang: string,
  translatedText: string,
): TranscriptLine {
  const normalizedTargetLang = targetLang.trim().toLowerCase();
  const normalizedText = translatedText.trim();

  if (!normalizedTargetLang || !normalizedText) {
    return line;
  }

  return {
    ...line,
    translation: normalizedTargetLang === "zh" ? normalizedText : line.translation,
    translations: {
      ...(line.translations ?? {}),
      [normalizedTargetLang]: normalizedText,
    },
  };
}

export const personaPresets: PersonaPreset[] = [
  {
    id: "enthusiastic",
    labelKey: "wizard.persona.enthusiastic",
    personality: {
      en: "Enthusiastic, energetic, uses vivid language",
      zh: "热情洋溢、充满活力、语言生动形象",
    },
    catchphrases: {
      en: "\"That's amazing!\", \"Let me tell you why this matters\"",
      zh: "\"太棒了！\"、\"让我告诉你为什么这很重要\"",
    },
    answerStyle: {
      en: "Hook -> storytelling -> takeaway",
      zh: "悬念开场 -> 故事叙述 -> 要点总结",
    },
  },
  {
    id: "analytical",
    labelKey: "wizard.persona.analytical",
    personality: {
      en: "Calm, analytical, uses data and analogies",
      zh: "冷静理性、善于分析、常用数据和类比",
    },
    catchphrases: {
      en: "\"Let me break this down\", \"The data shows...\"",
      zh: "\"让我拆解一下\"、\"数据显示……\"",
    },
    answerStyle: {
      en: "Definition -> analysis -> conclusion",
      zh: "定义概念 -> 深入分析 -> 得出结论",
    },
  },
  {
    id: "humorous",
    labelKey: "wizard.persona.humorous",
    personality: {
      en: "Witty, humorous, relatable storytelling",
      zh: "风趣幽默、擅长段子、讲述接地气",
    },
    catchphrases: {
      en: "\"Here's the funny part\", \"You won't believe this\"",
      zh: "\"搞笑的来了\"、\"你绝对想不到\"",
    },
    answerStyle: {
      en: "Joke -> insight -> punchline",
      zh: "段子 -> 引出观点 -> 金句收尾",
    },
  },
  {
    id: "professional",
    labelKey: "wizard.persona.professional",
    personality: {
      en: "Professional, structured, authoritative",
      zh: "专业严谨、条理清晰、权威可信",
    },
    catchphrases: {
      en: "\"According to research\", \"The key point is\"",
      zh: "\"根据研究表明\"、\"关键在于\"",
    },
    answerStyle: {
      en: "Context -> key points -> summary",
      zh: "背景铺垫 -> 核心要点 -> 精炼总结",
    },
  },
];

const defaultPersonaLanguagePreferences: Record<PersonaLocale, string> = {
  en: "English with concise technical framing",
  zh: "使用中文表达，简洁清晰，保留技术语境",
};

export const defaultIntegrationSettings: IntegrationSettings = {
  elevenlabs: "",
  elevenlabsVoiceId: "",
  elevenlabsAgentId: "",
  firecrawl: "",
  llmKey: "",
  llmUrl: "",
  llmModel: "",
};

export function normalizeIntegrationSettings(settings: Partial<IntegrationSettings> | undefined): IntegrationSettings {
  const merged = {
    ...defaultIntegrationSettings,
    ...settings,
  };

  const llmKey = merged.llmKey?.trim() ?? "";
  const llmUrl = merged.llmUrl?.trim() ?? "";
  const llmModel = merged.llmModel?.trim() ?? "";
  const looksLikeOldAutoFill =
    !llmKey &&
    (llmUrl === "placeholder" || llmUrl === "https://api.openai.com/v1") &&
    llmModel === "gpt-4o-mini";

  if (!looksLikeOldAutoFill) {
    return merged;
  }

  return {
    ...merged,
    llmUrl: "",
    llmModel: "",
  };
}

export const summaryEmotionClasses: Record<SummaryEmotion, string> = {
  lighthearted: "bg-emerald-500/10 text-emerald-500",
  serious: "bg-destructive/10 text-destructive",
  excited: "bg-accent/10 text-accent",
  reflective: "bg-info/10 text-info",
  humorous: "bg-primary/10 text-primary",
};

const summaryEmotionSet = new Set<string>(summaryEmotions);
const summaryEmotionMatchers: Array<[SummaryEmotion, RegExp]> = [
  ["humorous", /\b(humou?r|funny|witty|comic|comedic|joke|playful)\b/i],
  ["serious", /\b(serious|formal|professional|authoritative|grave|solemn)\b/i],
  ["reflective", /\b(reflective|thoughtful|calm|analytical|introspective|measured|contemplative)\b/i],
  ["excited", /\b(excited|exciting|energetic|enthusiastic|inspirational|inspired|vivid|passionate|dramatic)\b/i],
  ["lighthearted", /\b(lighthearted|light-hearted|light hearted|friendly|warm|casual|upbeat|bright|easygoing)\b/i],
];

export function normalizeSummaryEmotion(emotion: string | null | undefined): SummaryEmotion | null {
  const normalized = emotion?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const canonical = normalized.replace(/[_\s]+/g, "-");

  if (summaryEmotionSet.has(canonical)) {
    return canonical as SummaryEmotion;
  }

  for (const [mappedEmotion, pattern] of summaryEmotionMatchers) {
    if (pattern.test(normalized)) {
      return mappedEmotion;
    }
  }

  return null;
}

export function resolveSharedSummaryEmotion(
  summaries: Array<Pick<PodcastSummaryInput, "emotion">>,
): SummaryEmotion {
  const counts = new Map<SummaryEmotion, number>();
  const firstSeen = new Map<SummaryEmotion, number>();

  summaries.forEach((summary, index) => {
    const normalizedEmotion = normalizeSummaryEmotion(summary.emotion);

    if (!normalizedEmotion) {
      return;
    }

    counts.set(normalizedEmotion, (counts.get(normalizedEmotion) ?? 0) + 1);

    if (!firstSeen.has(normalizedEmotion)) {
      firstSeen.set(normalizedEmotion, index);
    }
  });

  const rankedEmotion = summaryEmotions
    .filter((emotion) => counts.has(emotion))
    .sort((left, right) => {
      const countDifference = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);

      if (countDifference !== 0) {
        return countDifference;
      }

      return (firstSeen.get(left) ?? Number.MAX_SAFE_INTEGER) - (firstSeen.get(right) ?? Number.MAX_SAFE_INTEGER);
    })[0];

  return rankedEmotion ?? "reflective";
}

export function normalizePodcastSummaries(summaries: PodcastSummaryInput[]): PodcastSummary[] {
  if (summaries.length === 0) {
    return [];
  }

  const sharedEmotion = resolveSharedSummaryEmotion(summaries);

  return summaries
    .map((summary) => {
      const directText = summary.text?.trim() ?? "";
      const legacyText = (summary.segments ?? [])
        .map((segment) => segment.text?.trim() ?? "")
        .filter(Boolean)
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim();

      return {
        duration: summary.duration,
        emotion: sharedEmotion,
        text: (directText || legacyText)
          .replace(/\r\n/g, "\n")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
        translations: normalizeTextTranslations(summary.translations),
      };
    })
    .filter((summary) => Boolean(summary.text));
}

export function setPodcastSummaryEmotion(
  summaries: PodcastSummary[],
  emotion: SummaryEmotion,
): PodcastSummary[] {
  return summaries.map((summary) =>
    summary.emotion === emotion
      ? summary
      : {
          ...summary,
          emotion,
        },
  );
}

export function timeToSeconds(value: string) {
  const parts = value.split(":").map(Number);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatDurationLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function inferTopic(title: string) {
  const lower = title.toLowerCase();
  const matched = topicPresets.find((preset) => lower.includes(preset.keyword));

  if (matched) {
    return matched;
  }

  return {
    topic: title.toLowerCase(),
  };
}

export function getPersonaPreset(presetId: string) {
  return personaPresets.find((preset) => preset.id === presetId) ?? personaPresets[0];
}

function findPersonaPreset(presetId: string | null | undefined) {
  const normalizedPresetId = presetId?.trim() ?? "";
  return personaPresets.find((preset) => preset.id === normalizedPresetId) ?? null;
}

function normalizePersonaLocale(locale: string | null | undefined): PersonaLocale {
  return locale === "zh" ? "zh" : "en";
}

function mergePersonaText(baseValue: string, customValue: string) {
  const normalizedBaseValue = baseValue.trim();
  const normalizedCustomValue = customValue.trim();

  if (!normalizedBaseValue) {
    return normalizedCustomValue;
  }

  if (!normalizedCustomValue) {
    return normalizedBaseValue;
  }

  return `${normalizedBaseValue}\n${normalizedCustomValue}`;
}

export function buildPersonaFromWizardInput(
  input: Pick<
    SavePodcastInput,
    "personaPresetId" | "personaLocale" | "customPersonality" | "customCatchphrases" | "customAnswerStyle"
  >,
  languagePref?: string,
) {
  const personaLocale = normalizePersonaLocale(input.personaLocale);
  const preset = findPersonaPreset(input.personaPresetId);
  const personality = mergePersonaText(preset?.personality[personaLocale] ?? "", input.customPersonality);
  const catchphrases = mergePersonaText(preset?.catchphrases[personaLocale] ?? "", input.customCatchphrases);
  const answerStyle = mergePersonaText(preset?.answerStyle[personaLocale] ?? "", input.customAnswerStyle);

  return {
    presetId: preset?.id ?? "",
    personality,
    catchphrases,
    answerStyle,
    languagePref: languagePref?.trim() || defaultPersonaLanguagePreferences[personaLocale],
    customPersonality: input.customPersonality,
    customCatchphrases: input.customCatchphrases,
    customAnswerStyle: input.customAnswerStyle,
  } satisfies PersonaSettings;
}

function makeDraftPodcast(input: SavePodcastInput, draft?: Podcast): Podcast {
  const title = input.title.trim();
  const persona = buildPersonaFromWizardInput(input, draft?.persona.languagePref);
  const speakers = draft?.speakers ?? [];
  const transcript = draft?.transcript ?? [];

  return {
    id: draft?.id ?? makePodcastId(),
    title,
    topic: inferTopic(title).topic,
    duration: draft?.duration ?? "00:00",
    createdAt: draft?.createdAt ?? new Date().toISOString(),
    aiHost: null,
    aiHostSpeakerId: draft?.aiHostSpeakerId ?? null,
    aiHostVoiceId: draft?.aiHostVoiceId ?? null,
    aiHostVoiceName: draft?.aiHostVoiceName ?? null,
    guestName: draft?.guestName ?? "",
    status: "configuring",
    color: draft?.color ?? colorChoices[Math.floor(Math.random() * colorChoices.length)],
    type: input.type,
    referenceCount: input.referenceCount,
    sourceFileName: input.sourceFileName,
    sourceFileSizeMb: input.sourceFileSizeMb,
    workflowStep: "queued",
    processingProgressPercent: draft?.processingProgressPercent ?? 0,
    processingError: draft?.processingError ?? null,
    wizardStep: draft?.wizardStep,
    progressPercent: 0,
    speed: draft?.speed ?? 1,
    transcriptMode: draft?.transcriptMode ?? "original",
    targetLang: draft?.targetLang ?? "zh",
    speakerFilter: draft?.speakerFilter ?? null,
    chapters: draft?.chapters ?? [],
    detectedSpeakerCount: draft?.detectedSpeakerCount ?? speakers.length,
    transcript,
    speakers,
    speakerProfiles: normalizeSpeakerProfiles(speakers, transcript, draft?.speakerProfiles),
    scriptChunks: draft?.scriptChunks ?? [],
    crawledPages: draft?.crawledPages ?? [],
    persona,
    summaries: normalizePodcastSummaries(draft?.summaries ?? []),
  };
}

export const initialAppData: AppDataState = {
  podcasts: [],
  integrationSettings: defaultIntegrationSettings,
};

export function sortPodcasts(podcasts: Podcast[]) {
  return [...podcasts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function makePodcastId() {
  return `podcast-${Date.now()}`;
}

export function buildPodcastFromWizard(input: SavePodcastInput, draft?: Podcast) {
  return makeDraftPodcast(input, draft);
}

export function resetPodcastForProcessing(podcast: Podcast): Podcast {
  return {
    ...podcast,
    topic: inferTopic(podcast.title).topic,
    duration: "00:00",
    aiHost: null,
    aiHostSpeakerId: null,
    aiHostVoiceId: null,
    aiHostVoiceName: null,
    guestName: "",
    status: "configuring",
    workflowStep: "queued",
    processingProgressPercent: 0,
    processingError: null,
    progressPercent: 0,
    speakerFilter: null,
    detectedSpeakerCount: 0,
    chapters: [],
    transcript: [],
    speakers: [],
    speakerProfiles: [],
    scriptChunks: [],
    crawledPages: [],
    summaries: [],
  };
}

export function getClientPodcastState(podcast: Podcast): ClientPodcastState {
  return {
    progressPercent: podcast.progressPercent,
    speed: podcast.speed,
    transcriptMode: podcast.transcriptMode,
    targetLang: podcast.targetLang,
    speakerFilter: podcast.speakerFilter,
  };
}

export function applyClientPodcastState(
  podcast: Podcast,
  state?: Partial<ClientPodcastState> | null,
): Podcast {
  if (!state) {
    return podcast;
  }

  return {
    ...podcast,
    progressPercent: state.progressPercent ?? podcast.progressPercent,
    speed: state.speed ?? podcast.speed,
    transcriptMode: state.transcriptMode ?? podcast.transcriptMode,
    targetLang: state.targetLang ?? podcast.targetLang,
    speakerFilter: state.speakerFilter ?? podcast.speakerFilter,
  };
}

export function getDominantSpeakerId(speakers: SpeakerSample[]) {
  let dominantSpeaker: SpeakerSample | null = null;

  for (const speaker of speakers) {
    if (!dominantSpeaker || speaker.pct > dominantSpeaker.pct) {
      dominantSpeaker = speaker;
    }
  }

  return dominantSpeaker?.id ?? null;
}

export function getPreferredAiHostSpeakerId(
  podcast: Pick<Podcast, "aiHostSpeakerId" | "speakers">,
) {
  if (podcast.aiHostSpeakerId && podcast.speakers.some((speaker) => speaker.id === podcast.aiHostSpeakerId)) {
    return podcast.aiHostSpeakerId;
  }

  return getDominantSpeakerId(podcast.speakers);
}

export function renamePodcastSpeaker(
  podcast: Podcast,
  speakerId: string,
  nextName: string,
): Podcast {
  const normalizedName = nextName.trim();

  if (!normalizedName) {
    return podcast;
  }

  const targetSpeaker = podcast.speakers.find((speaker) => speaker.id === speakerId);

  if (!targetSpeaker) {
    return podcast;
  }

  const currentName = targetSpeaker.name;
  let changed = false;

  const speakers = podcast.speakers.map((speaker) => {
    if (speaker.id !== speakerId || speaker.name === normalizedName) {
      return speaker;
    }

    changed = true;
    return {
      ...speaker,
      name: normalizedName,
    };
  });

  const transcript = podcast.transcript.map((line) => {
    const matchesSpeaker =
      line.speakerId === speakerId || (!line.speakerId && line.speaker === currentName);

    if (!matchesSpeaker || line.speaker === normalizedName) {
      return line;
    }

    changed = true;
    return {
      ...line,
      speaker: normalizedName,
    };
  });

  const aiHost =
    podcast.aiHostSpeakerId === speakerId || podcast.aiHost === currentName
      ? normalizedName
      : podcast.aiHost;
  const guestName = podcast.guestName === currentName ? normalizedName : podcast.guestName;
  const speakerFilter = podcast.speakerFilter === currentName ? normalizedName : podcast.speakerFilter;
  const speakerProfiles = normalizeSpeakerProfiles(
    speakers,
    transcript,
    podcast.speakerProfiles.map((profile) =>
      profile.speakerId === speakerId
        ? {
            ...profile,
            displayName: normalizedName,
          }
        : profile,
    ),
  );

  if (
    !changed &&
    aiHost === podcast.aiHost &&
    guestName === podcast.guestName &&
    speakerFilter === podcast.speakerFilter &&
    JSON.stringify(speakerProfiles) === JSON.stringify(podcast.speakerProfiles)
  ) {
    return podcast;
  }

  return {
    ...podcast,
    aiHost,
    guestName,
    speakerFilter,
    speakers,
    speakerProfiles,
    transcript,
  };
}

export function getPodcastSpeakerCount(
  podcast: Pick<Podcast, "detectedSpeakerCount" | "speakers" | "transcript" | "type" | "referenceCount">,
) {
  if (podcast.detectedSpeakerCount > 0) {
    return podcast.detectedSpeakerCount;
  }

  if (podcast.speakers.length > 0) {
    return podcast.speakers.length;
  }

  const transcriptSpeakerCount = new Set(
    podcast.transcript
      .map((line) => line.speakerId?.trim() || line.speaker?.trim() || "")
      .filter(Boolean),
  ).size;

  if (transcriptSpeakerCount > 0) {
    return transcriptSpeakerCount;
  }

  return podcast.type === "solo" ? 1 : Math.max(1, podcast.referenceCount);
}

export function supportsGroupChat(
  podcast: Pick<Podcast, "detectedSpeakerCount">,
) {
  return podcast.detectedSpeakerCount >= 2;
}

export function getSummary(podcast: Podcast, duration: number) {
  return podcast.summaries.find((summary) => summary.duration === duration) ?? null;
}

export function getTranslatedTranscript(line: TranscriptLine, targetLang: string) {
  const cachedTranslation = getTranscriptTranslation(line, targetLang);

  if (cachedTranslation) {
    return cachedTranslation;
  }

  const langLabel = targetLangs.find((lang) => lang.code === targetLang)?.label ?? targetLang.toUpperCase();
  return `[${langLabel}] ${line.text}`;
}

export function isPodcastReady(podcast: Podcast) {
  return (
    podcast.status === "ready" &&
    podcast.transcript.length > 0 &&
    podcast.summaries.length > 0 &&
    Boolean(podcast.aiHost)
  );
}

export function canRegeneratePodcast(podcast: Podcast) {
  return podcast.status === "ready" || Boolean(podcast.processingError);
}

export function isLegacyMockPodcast(podcast: Podcast) {
  return podcast.id.startsWith("demo-");
}

export function getPodcastWorkflowStep(podcast: Podcast): PodcastWorkflowStep | null {
  if (podcast.status !== "configuring") {
    return null;
  }

  if (podcast.workflowStep && setupWorkflowSteps.includes(podcast.workflowStep)) {
    return podcast.workflowStep;
  }

  if (podcast.workflowStep && processingWorkflowSteps.includes(podcast.workflowStep) && podcast.workflowStep !== "queued") {
    return podcast.workflowStep;
  }

  if (podcast.transcript.length > 0 && podcast.summaries.length === 0) {
    return "summarizing";
  }

  if (podcast.transcript.length > 0 && podcast.summaries.length > 0 && podcast.scriptChunks.length === 0 && podcast.crawledPages.length === 0) {
    return "knowledge";
  }

  if ((podcast.transcript.length > 0 || podcast.summaries.length > 0) && !podcast.aiHost) {
    return "finalizing";
  }

  return podcast.workflowStep ?? "queued";
}

export function getPodcastWorkflowSteps(podcast: Podcast): PodcastWorkflowStep[] {
  const currentStep = getPodcastWorkflowStep(podcast);

  if (!currentStep) {
    return [];
  }

  return setupWorkflowSteps.includes(currentStep) ? setupWorkflowSteps : processingWorkflowSteps;
}

export function getPodcastWorkflowIndex(podcast: Podcast) {
  const currentStep = getPodcastWorkflowStep(podcast);
  const steps = getPodcastWorkflowSteps(podcast);

  if (!currentStep) {
    return -1;
  }

  return steps.indexOf(currentStep);
}
