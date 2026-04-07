import "server-only";

import { readFile } from "node:fs/promises";
import {
  buildKnowledgeSearchQueries,
  buildKnowledgeSignals,
  extractKnowledgeExcerpt,
  findMatchedKnowledgeTerms,
  hasKnowledgeLinkMatch,
  normalizeKnowledgeLink,
  type KnowledgeSignals,
} from "@/lib/knowledge-base";
import {
  formatClock,
  normalizePodcastSummaries,
  summaryDurations,
  type Chapter,
  type CrawledPage,
  type IntegrationSettings,
  type Podcast,
  type PodcastSummary,
  type ScriptChunk,
  type SpeakerSample,
  type TranscriptLine,
} from "@/lib/podchat-data";
import {
  hasLlmConfig,
  requestOpenAiCompatibleJson,
  searchFirecrawlWeb,
} from "@/lib/server/integrations";
import {
  buildSpeakerPresentation,
  hasElevenLabsConfig,
  transcribeAudioWithElevenLabs,
} from "@/lib/server/elevenlabs";

interface StructuredSummaryItem {
  duration: number;
  emotion?: string;
  text?: string;
  segments?: Array<{
    label?: string;
    text?: string;
  }>;
}

interface StructuredPodcastMetadataOutput {
  topic?: string;
  aiHost?: string;
  guestName?: string;
  chapters?: Array<{
    title: string;
    lineId?: string;
  }>;
  knowledgeSignals?: {
    terms?: string[];
    links?: string[];
  };
}

interface StructuredPodcastSummaryOutput {
  summaries?: StructuredSummaryItem[];
}

export interface LiveProcessingOutput {
  duration: string;
  topic: string;
  aiHost: string;
  aiHostSpeakerId: string | null;
  aiHostVoiceId: string | null;
  aiHostVoiceName: string | null;
  guestName: string;
  transcript: TranscriptLine[];
  chapters: Chapter[];
  summaries: PodcastSummary[];
  scriptChunks: ScriptChunk[];
  crawledPages: CrawledPage[];
  speakers: SpeakerSample[];
}

interface ScoredKnowledgePage {
  score: number;
  page: Omit<CrawledPage, "id">;
}

function scoreKnowledgePage(
  result: {
    url?: string;
    title?: string;
    description?: string;
    markdown?: string;
  },
  signals: KnowledgeSignals,
): ScoredKnowledgePage | null {
  const normalizedUrl = normalizeKnowledgeLink(result.url ?? "");

  if (!normalizedUrl) {
    return null;
  }

  const searchText = [result.title, result.description, result.markdown].filter(Boolean).join("\n");
  const matchedTerms = findMatchedKnowledgeTerms(searchText, signals.terms);
  const matchesExplicitLink = hasKnowledgeLinkMatch(normalizedUrl, signals.links);
  const excerpt = extractKnowledgeExcerpt(result.markdown ?? result.description ?? "", matchedTerms.length > 0 ? matchedTerms : signals.terms);

  if (!matchesExplicitLink && matchedTerms.length === 0) {
    return null;
  }

  if (!excerpt && !matchesExplicitLink) {
    return null;
  }

  const score =
    matchedTerms.length * 5 +
    (matchesExplicitLink ? 6 : 0) +
    (excerpt ? 2 : 0) +
    (result.title?.trim() ? 1 : 0) +
    (/https?:\/\/[^/]+\/.+/.test(normalizedUrl) ? 1 : 0);

  const reason = matchesExplicitLink
    ? matchedTerms.length > 0
      ? `Mentioned link and matched script terms: ${matchedTerms.join(", ")}`
      : "Mentioned directly in the script"
    : `Matched script terms: ${matchedTerms.join(", ")}`;

  return {
    score,
    page: {
      title: result.title?.trim() || "Reference",
      url: normalizedUrl,
      excerpt,
      matchedTerms,
      reason,
    },
  };
}

async function searchKnowledgePages(
  podcast: Podcast,
  settings: IntegrationSettings,
  transcript: TranscriptLine[],
  rawSignals?: StructuredPodcastMetadataOutput["knowledgeSignals"],
) {
  if (!settings.firecrawl?.trim()) {
    return [] as CrawledPage[];
  }

  const signals = buildKnowledgeSignals({
    podcastTitle: podcast.title,
    podcastTopic: podcast.topic,
    transcript,
    rawTerms: rawSignals?.terms,
    rawLinks: rawSignals?.links,
  });
  const queries = buildKnowledgeSearchQueries(signals);

  if (queries.length === 0) {
    return [] as CrawledPage[];
  }

  const maxPages = Math.max(1, Math.min(podcast.referenceCount, 4));
  const candidates = new Map<string, ScoredKnowledgePage>();

  for (const query of queries) {
    const results = await searchFirecrawlWeb(settings.firecrawl, query, Math.max(2, maxPages * 2));

    for (const result of results) {
      const scored = scoreKnowledgePage(result, signals);

      if (!scored) {
        continue;
      }

      const previous = candidates.get(scored.page.url);

      if (!previous || (previous && scored.score > previous.score)) {
        candidates.set(scored.page.url, scored);
      }
    }
  }

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, maxPages)
    .map((candidate, index) => ({
      id: index + 1,
      title: candidate.page.title || `Reference ${index + 1}`,
      url: candidate.page.url,
      excerpt: candidate.page.excerpt,
      matchedTerms: candidate.page.matchedTerms,
      reason: candidate.page.reason,
    }));
}

async function searchKnowledgePagesSafely(input: {
  podcast: Podcast;
  settings: IntegrationSettings;
  transcript: TranscriptLine[];
  rawSignals?: StructuredPodcastMetadataOutput["knowledgeSignals"];
}) {
  try {
    return await searchKnowledgePages(
      input.podcast,
      input.settings,
      input.transcript,
      input.rawSignals,
    );
  } catch (error) {
    console.warn(`Failed to enrich podcast ${input.podcast.id} with Firecrawl references.`, error);
    return [] as CrawledPage[];
  }
}

function deriveTranscriptChapters(transcript: TranscriptLine[]) {
  if (transcript.length === 0) {
    return [] as Chapter[];
  }

  const selectedLines = [
    transcript[0],
    transcript[Math.min(transcript.length - 1, Math.floor(transcript.length / 2))],
    transcript[transcript.length - 1],
  ].filter(Boolean);

  return selectedLines.map((line, index) => ({
    id: `chapter-${index + 1}`,
    title: line.text.split(/\s+/).slice(0, 6).join(" ").replace(/[.,!?。！？]$/, "") || `Part ${index + 1}`,
    time: line.time,
  }));
}

function renderTranscriptLineForPrompt(line: TranscriptLine) {
  return `[${line.id}] [${line.time}] ${line.speaker}: ${line.text}`;
}

function excerptTranscriptForPrompt(transcript: TranscriptLine[]) {
  const renderedLines = transcript.map(renderTranscriptLineForPrompt);
  const fullTranscript = renderedLines.join("\n");
  const maxChars = 42000;

  if (fullTranscript.length <= maxChars) {
    return fullTranscript;
  }

  const sampledLineCount = Math.min(transcript.length, 220);
  const sampledIndexes = new Set<number>();

  for (let index = 0; index < sampledLineCount; index += 1) {
    const sampledIndex = Math.round((index * (transcript.length - 1)) / Math.max(sampledLineCount - 1, 1));
    sampledIndexes.add(sampledIndex);
  }

  let excerpt = "";

  for (const sampledIndex of [...sampledIndexes].sort((left, right) => left - right)) {
    const line = renderedLines[sampledIndex];
    const nextExcerpt = excerpt ? `${excerpt}\n${line}` : line;

    if (nextExcerpt.length > maxChars) {
      break;
    }

    excerpt = nextExcerpt;
  }

  return excerpt;
}

function sanitizeSummaries(
  rawSummaries: StructuredPodcastSummaryOutput["summaries"],
) {
  return normalizePodcastSummaries(
    (rawSummaries ?? [])
      .filter((summary) => summaryDurations.includes(summary.duration as (typeof summaryDurations)[number]))
      .map((summary) => ({
        duration: summary.duration,
        emotion: summary.emotion,
        text: summary.text?.trim() || "",
        segments: summary.segments?.slice(0, 4).map((segment) => ({
          text: segment.text?.trim() || "",
        })),
      }))
      .filter((summary) => Boolean(summary.text || summary.segments?.some((segment) => segment.text))),
  );
}

function sanitizeChapters(rawChapters: StructuredPodcastMetadataOutput["chapters"], transcript: TranscriptLine[]) {
  const chapterByLineId = new Map(transcript.map((line) => [line.id, line.time]));

  return (rawChapters ?? [])
    .slice(0, 5)
    .map((chapter, index) => ({
      id: `chapter-${index + 1}`,
      title: chapter.title?.trim() || `Part ${index + 1}`,
      time: chapter.lineId ? chapterByLineId.get(chapter.lineId) ?? null : null,
    }))
    .filter((chapter): chapter is Chapter => Boolean(chapter.title && chapter.time));
}

async function requestStructuredPodcastMetadata(input: {
  podcast: Podcast;
  transcriptPrompt: string;
  settings: IntegrationSettings;
}) {
  const { podcast, transcriptPrompt, settings } = input;

  return requestOpenAiCompatibleJson<StructuredPodcastMetadataOutput>(settings, {
    temperature: 0.2,
    max_tokens: 1400,
    messages: [
      {
        role: "system",
        content: [
          "You are structuring a processed podcast for a web application.",
          "Return JSON with these keys only: topic, aiHost, guestName, chapters, knowledgeSignals.",
          "aiHost and guestName must be chosen from the speaker labels already present in the transcript, such as Speaker 1 or Speaker 2. Do not invent new names.",
          "chapters: array of objects with title and lineId.",
          "knowledgeSignals: object with arrays named terms and links. Include only technical terms, products, people, organizations, documents, URLs, or domains explicitly mentioned in the transcript. Never include generic filler like podcast, episode, host, guest, summary, discussion.",
          "Use the transcript only. Do not invent details beyond the provided material.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Podcast title: ${podcast.title}`,
          `Requested type: ${podcast.type}`,
          "Transcript (full when it fits; otherwise sampled across the whole episode):",
          transcriptPrompt,
        ].join("\n\n"),
      },
    ],
  });
}

async function requestStructuredPodcastSummaries(input: {
  podcast: Podcast;
  transcriptPrompt: string;
  settings: IntegrationSettings;
}) {
  const { podcast, transcriptPrompt, settings } = input;

  return requestOpenAiCompatibleJson<StructuredPodcastSummaryOutput>(settings, {
    temperature: 0.2,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: [
          "You are generating spoken podcast summaries for a web application.",
          "Return JSON with this key only: summaries.",
          "summaries: array for durations 1, 3, 5, and 10. Each item must contain duration, emotion, and text.",
          "Use exactly one shared emotion across every summary item, chosen only from: lighthearted, serious, excited, reflective, humorous.",
          "Each text must be a single cohesive spoken summary that can be read aloud directly.",
          "Do not use headings, labels, bullets, numbering, markdown, or category splits.",
          "Do not split the summary into sections such as background, context, location, setup, key points, takeaway, or conclusion.",
          "Do not prepend the duration or any title.",
          "Keep the content grounded only in the transcript. Do not invent details.",
          "Write in the dominant language of the transcript.",
          "Match the requested spoken length as closely as possible without padding or filler. For English, aim for roughly 130 to 160 spoken words per minute. For other languages, use a comparable natural speaking pace.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Podcast title: ${podcast.title}`,
          `Requested summary durations: ${summaryDurations.join(", ")} minutes`,
          "Transcript (full when it fits; otherwise sampled across the whole episode):",
          transcriptPrompt,
        ].join("\n\n"),
      },
    ],
  });
}

export async function generateLivePodcastOutput(input: {
  podcast: Podcast;
  uploadedFilePath: string;
  sourceFileName: string;
  settings: IntegrationSettings;
}) {
  const { podcast, uploadedFilePath, sourceFileName, settings } = input;

  if (!hasElevenLabsConfig(settings)) {
    throw new Error("ElevenLabs API key is required for voice processing.");
  }

  if (!hasLlmConfig(settings)) {
    throw new Error("LLM configuration is required to generate non-mock summaries and knowledge data.");
  }

  const transcription = await transcribeAudioWithElevenLabs(
    settings,
    {
      fileName: sourceFileName,
      fileBytes: await readFile(uploadedFilePath),
      diarize: podcast.type === "multi",
      referenceSpeakerCount: podcast.type === "multi" ? podcast.referenceCount : null,
    },
  );
  const neutralSpeakerPresentation = buildSpeakerPresentation(
    transcription.transcriptLines,
    "Speaker 1",
    transcription.transcriptLines.length > 1 ? "Speaker 2" : "",
  );
  const transcriptPrompt = excerptTranscriptForPrompt(neutralSpeakerPresentation.transcript);
  const [structuredMetadata, structuredSummaries] = await Promise.all([
    requestStructuredPodcastMetadata({
      podcast,
      transcriptPrompt,
      settings,
    }),
    requestStructuredPodcastSummaries({
      podcast,
      transcriptPrompt,
      settings,
    }),
  ]);
  const summaries = sanitizeSummaries(structuredSummaries.summaries);

  if (summaries.length === 0) {
    throw new Error("LLM output did not contain valid summaries.");
  }

  const aiHostLabel = structuredMetadata.aiHost?.trim() || neutralSpeakerPresentation.speakers[0]?.name || "Speaker 1";
  const guestLabel = structuredMetadata.guestName?.trim() || neutralSpeakerPresentation.speakers[1]?.name || "";
  const presentedSpeakers = buildSpeakerPresentation(
    transcription.transcriptLines,
    aiHostLabel,
    guestLabel,
  );
  const chapters = sanitizeChapters(structuredMetadata.chapters, presentedSpeakers.transcript);
  const crawledPages = await searchKnowledgePagesSafely({
    podcast,
    settings,
    transcript: neutralSpeakerPresentation.transcript,
    rawSignals: structuredMetadata.knowledgeSignals,
  });
  const aiHostSpeaker = presentedSpeakers.speakers.find((speaker) => speaker.name === aiHostLabel) ?? presentedSpeakers.speakers[0] ?? null;

  if (!aiHostSpeaker) {
    throw new Error("Failed to resolve an AI host speaker from the transcript.");
  }

  return {
    duration: formatClock(Math.round(transcription.durationSeconds)),
    topic: structuredMetadata.topic?.trim() || podcast.topic || podcast.title,
    aiHost: aiHostSpeaker.name,
    aiHostSpeakerId: aiHostSpeaker.id,
    aiHostVoiceId: null,
    aiHostVoiceName: null,
    guestName: guestLabel && guestLabel !== aiHostSpeaker.name ? guestLabel : "",
    transcript: presentedSpeakers.transcript,
    chapters: chapters.length > 0 ? chapters : deriveTranscriptChapters(presentedSpeakers.transcript),
    summaries,
    scriptChunks: [],
    crawledPages,
    speakers: presentedSpeakers.speakers,
  } satisfies LiveProcessingOutput;
}
