import type { ScriptChunk, TranscriptLine } from "@/lib/podchat-data";

export interface KnowledgeSignals {
  terms: string[];
  links: string[];
}

const genericTerms = new Set([
  "a",
  "an",
  "and",
  "api",
  "app",
  "article",
  "blog",
  "chat",
  "content",
  "conversation",
  "course",
  "data",
  "demo",
  "details",
  "discussion",
  "docs",
  "episode",
  "example",
  "guest",
  "guide",
  "host",
  "idea",
  "info",
  "information",
  "interview",
  "issue",
  "item",
  "knowledge",
  "learn",
  "lesson",
  "link",
  "material",
  "method",
  "model",
  "note",
  "page",
  "podcast",
  "product",
  "project",
  "question",
  "reference",
  "resource",
  "result",
  "script",
  "show",
  "site",
  "speaker",
  "step",
  "story",
  "summary",
  "system",
  "talk",
  "term",
  "text",
  "thing",
  "tip",
  "tool",
  "topic",
  "video",
  "website",
]);

const urlPattern = /\b((?:https?:\/\/|www\.)[^\s<>"')]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"')]+)?)/gi;
const properNounPattern = /\b(?:[A-Z][A-Za-z0-9+#.-]*(?:\s+[A-Z][A-Za-z0-9+#.-]*){0,3}|[A-Z]{2,}(?:[-/][A-Z0-9]{2,})*)\b/g;
const markdownNoisePattern = /^([#>*`|-]|!\[|\[.+\]\(.+\)|table of contents|contents|navigation|menu|home|search|sign in|log in)/i;

function trimPunctuation(value: string) {
  return value.trim().replace(/^[\s"'`([{<]+/, "").replace(/[\s"'`)\]}>.,;:!?]+$/, "");
}

export function normalizeKnowledgeLink(value: string) {
  const cleaned = trimPunctuation(value);

  if (!cleaned) {
    return "";
  }

  const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned.replace(/^www\./i, "www.")}`;

  try {
    const parsed = new URL(withScheme);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function normalizeKnowledgeTerm(value: string) {
  const cleaned = trimPunctuation(value).replace(/\s+/g, " ");

  if (!cleaned || cleaned.length < 3 || cleaned.length > 80) {
    return "";
  }

  if (/^\d+$/.test(cleaned)) {
    return "";
  }

  const normalizedKey = cleaned.toLowerCase();

  if (genericTerms.has(normalizedKey)) {
    return "";
  }

  if (!/[\p{L}\p{N}]/u.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function dedupeOrdered(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value);
  }

  return output;
}

export function extractExplicitLinks(text: string) {
  const matches = text.match(urlPattern) ?? [];

  return dedupeOrdered(
    matches
      .map((match) => normalizeKnowledgeLink(match))
      .filter(Boolean),
  );
}

function extractProperNouns(text: string) {
  const matches = text.match(properNounPattern) ?? [];

  return dedupeOrdered(
    matches
      .map((match) => normalizeKnowledgeTerm(match))
      .filter(Boolean),
  );
}

function looksLikeMeaningfulLine(line: string) {
  const compact = line.trim().replace(/\s+/g, " ");

  if (!compact || compact.length < 30) {
    return false;
  }

  if (markdownNoisePattern.test(compact)) {
    return false;
  }

  if ((compact.match(/[/:|]/g) ?? []).length > 10 && compact.length < 120) {
    return false;
  }

  return true;
}

export function findMatchedKnowledgeTerms(text: string, terms: string[]) {
  const normalizedText = text.toLowerCase();

  return terms.filter((term) => normalizedText.includes(term.toLowerCase()));
}

export function extractKnowledgeExcerpt(markdown: string, terms: string[]) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/[*_`>#-]+/g, " ").replace(/\[(.*?)\]\((.*?)\)/g, "$1").replace(/\s+/g, " ").trim())
    .filter(looksLikeMeaningfulLine);

  if (lines.length === 0) {
    return "";
  }

  const prioritized =
    lines.find((line) => findMatchedKnowledgeTerms(line, terms).length > 0) ??
    lines.find((line) => line.length >= 48) ??
    lines[0];

  return prioritized.slice(0, 280).trim();
}

export function buildKnowledgeSignals(input: {
  podcastTitle: string;
  podcastTopic: string;
  transcript: TranscriptLine[];
  scriptChunks: ScriptChunk[];
  rawTerms?: string[] | null;
  rawLinks?: string[] | null;
}): KnowledgeSignals {
  const transcriptText = input.transcript.map((line) => line.text).join("\n");
  const scriptText = input.scriptChunks.map((chunk) => chunk.text).join("\n");
  const extractedTerms = dedupeOrdered(
    [
      ...(input.rawTerms ?? []),
      ...extractProperNouns(scriptText),
      ...extractProperNouns(transcriptText),
    ]
      .map((term) => normalizeKnowledgeTerm(term))
      .filter(Boolean),
  );
  const fallbackTerms = extractedTerms.length === 0
    ? [input.podcastTitle, input.podcastTopic]
        .map((term) => normalizeKnowledgeTerm(term))
        .filter(Boolean)
    : [];

  const terms = dedupeOrdered([...extractedTerms, ...fallbackTerms]).slice(0, 8);

  const links = dedupeOrdered(
    [
      ...(input.rawLinks ?? []),
      ...extractExplicitLinks(scriptText),
      ...extractExplicitLinks(transcriptText),
    ]
      .map((link) => normalizeKnowledgeLink(link))
      .filter(Boolean),
  ).slice(0, 4);

  return {
    terms,
    links,
  };
}

export function buildKnowledgeSearchQueries(signals: KnowledgeSignals) {
  const linkQueries = signals.links.slice(0, 2);
  const termQuery = signals.terms
    .slice(0, 4)
    .map((term) => (/\s/.test(term) ? `"${term}"` : term))
    .join(" ")
    .trim();

  return dedupeOrdered([
    ...linkQueries,
    ...(termQuery ? [termQuery] : []),
  ]).slice(0, 3);
}

function normalizeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function hasKnowledgeLinkMatch(candidateUrl: string, links: string[]) {
  const candidate = normalizeKnowledgeLink(candidateUrl);

  if (!candidate) {
    return false;
  }

  const candidateHost = normalizeHost(candidate);

  return links.some((link) => {
    const normalized = normalizeKnowledgeLink(link);

    if (!normalized) {
      return false;
    }

    if (candidate === normalized) {
      return true;
    }

    const linkHost = normalizeHost(normalized);
    return Boolean(linkHost && candidateHost && linkHost === candidateHost);
  });
}
