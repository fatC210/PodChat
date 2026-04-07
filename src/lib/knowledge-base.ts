import type { TranscriptLine } from "@/lib/podchat-data";

export interface KnowledgeSignals {
  terms: string[];
  links: string[];
}

const genericTerms = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "api",
  "app",
  "article",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "blog",
  "both",
  "but",
  "by",
  "can",
  "chat",
  "content",
  "conversation",
  "course",
  "data",
  "demo",
  "details",
  "did",
  "discussion",
  "docs",
  "does",
  "doing",
  "done",
  "down",
  "during",
  "episode",
  "even",
  "example",
  "every",
  "few",
  "for",
  "from",
  "guest",
  "guide",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "hers",
  "him",
  "his",
  "host",
  "how",
  "i",
  "idea",
  "if",
  "info",
  "information",
  "into",
  "interview",
  "is",
  "issue",
  "item",
  "it",
  "its",
  "itself",
  "just",
  "knowledge",
  "learn",
  "lesson",
  "let",
  "lets",
  "link",
  "like",
  "material",
  "may",
  "maybe",
  "me",
  "might",
  "method",
  "model",
  "more",
  "most",
  "my",
  "myself",
  "need",
  "never",
  "new",
  "no",
  "note",
  "now",
  "of",
  "off",
  "on",
  "once",
  "one",
  "only",
  "or",
  "our",
  "ours",
  "ourselves",
  "page",
  "podcast",
  "please",
  "product",
  "project",
  "question",
  "really",
  "reference",
  "resource",
  "result",
  "script",
  "see",
  "she",
  "show",
  "so",
  "some",
  "something",
  "site",
  "still",
  "speaker",
  "such",
  "step",
  "story",
  "summary",
  "system",
  "talk",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "term",
  "text",
  "than",
  "thing",
  "think",
  "this",
  "those",
  "three",
  "through",
  "tip",
  "to",
  "tool",
  "topic",
  "two",
  "up",
  "us",
  "very",
  "video",
  "want",
  "was",
  "we",
  "well",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "would",
  "website",
  "you",
  "your",
  "yours",
  "yourself",
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

function tokenizeKnowledgeText(value: string) {
  return value.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu) ?? [];
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
  const termCounts = new Map<string, number>();

  for (const match of matches) {
    const normalized = normalizeKnowledgeTerm(match);

    if (!normalized) {
      continue;
    }

    termCounts.set(normalized, (termCounts.get(normalized) ?? 0) + 1);
  }

  return [...termCounts.entries()]
    .filter(([term, count]) => {
      if (/\s/.test(term)) {
        return true;
      }

      if (/[+#.-]|\d/.test(term)) {
        return true;
      }

      if (/^[A-Z]{2,}$/.test(term)) {
        return true;
      }

      if (/^[A-Z][a-z]+(?:[A-Z][A-Za-z0-9]*)+$/.test(term)) {
        return true;
      }

      return count >= 2;
    })
    .map(([term]) => term);
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
  const textTokens = new Set(tokenizeKnowledgeText(text));

  return terms.filter((term) => {
    const normalizedTerm = term.toLowerCase();

    if (normalizedText.includes(normalizedTerm)) {
      return true;
    }

    const tokens = dedupeOrdered(
      tokenizeKnowledgeText(term).filter((token) => token.length > 2 && !genericTerms.has(token)),
    );

    if (tokens.length === 0) {
      return false;
    }

    const matchedTokenCount = tokens.filter((token) => textTokens.has(token)).length;

    if (tokens.length === 1) {
      return matchedTokenCount === 1;
    }

    if (tokens.length === 2) {
      return matchedTokenCount === 2;
    }

    if (tokens.length <= 4) {
      return matchedTokenCount >= 2;
    }

    return matchedTokenCount >= 3;
  });
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
  rawTerms?: string[] | null;
  rawLinks?: string[] | null;
}): KnowledgeSignals {
  const transcriptText = input.transcript.map((line) => line.text).join("\n");
  const prioritizedTerms = [input.podcastTopic, input.podcastTitle]
    .map((term) => normalizeKnowledgeTerm(term))
    .filter(Boolean);
  const extractedTerms = dedupeOrdered(
    [
      ...(input.rawTerms ?? []),
      ...prioritizedTerms,
      ...extractProperNouns(transcriptText),
    ]
      .map((term) => normalizeKnowledgeTerm(term))
      .filter(Boolean),
  );
  const terms = extractedTerms.slice(0, 10);

  const links = dedupeOrdered(
    [
      ...(input.rawLinks ?? []),
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
  const phraseTerms = signals.terms.filter((term) => /\s/.test(term));
  const primaryPhrase = phraseTerms[0] ?? "";
  const alternatePhrase = phraseTerms.find((term) => term !== primaryPhrase) ?? "";
  const focusedTerms = signals.terms
    .filter((term) => term !== primaryPhrase)
    .slice(0, primaryPhrase ? 3 : 4);
  const formatQueryTerm = (term: string) => {
    const wordCount = term.trim().split(/\s+/).length;

    if (!/\s/.test(term)) {
      return term;
    }

    return wordCount <= 4 ? `"${term}"` : term;
  };
  const termQuery = [primaryPhrase, ...focusedTerms]
    .filter(Boolean)
    .map((term) => formatQueryTerm(term))
    .join(" ")
    .trim();

  return dedupeOrdered([
    ...linkQueries,
    ...(termQuery ? [termQuery] : []),
    ...(primaryPhrase ? [formatQueryTerm(primaryPhrase)] : []),
    ...(alternatePhrase ? [formatQueryTerm(alternatePhrase)] : []),
  ]).slice(0, 4);
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
