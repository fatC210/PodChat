import { describe, expect, it } from "vitest";
import {
  buildKnowledgeSearchQueries,
  buildKnowledgeSignals,
  extractKnowledgeExcerpt,
  findMatchedKnowledgeTerms,
  hasKnowledgeLinkMatch,
} from "@/lib/knowledge-base";
import type { TranscriptLine } from "@/lib/podchat-data";

const transcript: TranscriptLine[] = [
  {
    id: "line-1",
    speaker: "Speaker 1",
    color: "text-accent",
    time: "0:00",
    endTime: "0:08",
    text: "Today we compare React Server Components with MCP tooling and point people to https://nextjs.org/docs/app.",
    translation: "Today we compare React Server Components with MCP tooling and point people to https://nextjs.org/docs/app.",
  },
];

describe("buildKnowledgeSignals", () => {
  it("keeps transcript terms, topic terms, and explicit links", () => {
    const signals = buildKnowledgeSignals({
      podcastTitle: "Framework Roundtable",
      podcastTopic: "web architecture",
      transcript,
      rawTerms: ["React Server Components", "MCP"],
      rawLinks: [],
    });

    expect(signals.terms).toContain("React Server Components");
    expect(signals.terms).toContain("MCP");
    expect(signals.links).toContain("https://nextjs.org/docs/app");
    expect(signals.terms).not.toContain("podcast");
  });

  it("falls back to the topic instead of sentence-start filler words", () => {
    const fillerTranscript: TranscriptLine[] = [
      {
        id: "line-1",
        speaker: "Speaker 1",
        color: "text-accent",
        time: "0:00",
        endTime: "0:05",
        text: "You can become a stronger speaker when you practice a clear structure.",
        translation: "You can become a stronger speaker when you practice a clear structure.",
      },
      {
        id: "line-2",
        speaker: "Speaker 1",
        color: "text-accent",
        time: "0:05",
        endTime: "0:10",
        text: "But the biggest gains come from deliberate public speaking drills.",
        translation: "But the biggest gains come from deliberate public speaking drills.",
      },
    ];

    const signals = buildKnowledgeSignals({
      podcastTitle: "1213",
      podcastTopic: "Advanced Communication Techniques for Public Speaking",
      transcript: fillerTranscript,
      rawTerms: [],
      rawLinks: [],
    });

    expect(signals.terms[0]).toBe("Advanced Communication Techniques for Public Speaking");
    expect(signals.terms).not.toContain("You");
    expect(signals.terms).not.toContain("But");
  });
});

describe("buildKnowledgeSearchQueries", () => {
  it("prioritizes mentioned links and focused term queries", () => {
    const queries = buildKnowledgeSearchQueries({
      terms: ["React Server Components", "Next.js", "App Router"],
      links: ["https://nextjs.org/docs/app"],
    });

    expect(queries[0]).toBe("https://nextjs.org/docs/app");
    expect(queries[1]).toContain("\"React Server Components\"");
    expect(queries[1]).toContain("Next.js");
  });
});

describe("findMatchedKnowledgeTerms", () => {
  it("matches long topic phrases by overlapping keywords", () => {
    const matches = findMatchedKnowledgeTerms(
      "These public speaking techniques can help you communicate with more confidence on stage.",
      ["Advanced Communication Techniques for Public Speaking"],
    );

    expect(matches).toContain("Advanced Communication Techniques for Public Speaking");
  });
});

describe("extractKnowledgeExcerpt", () => {
  it("prefers lines that mention matched terms instead of navigation noise", () => {
    const excerpt = extractKnowledgeExcerpt(
      [
        "# Navigation",
        "Home",
        "Search",
        "React Server Components let you render and stream UI from the server while keeping client bundles smaller.",
        "API Reference",
      ].join("\n"),
      ["React Server Components"],
    );

    expect(excerpt).toContain("React Server Components let you render and stream UI from the server");
    expect(excerpt).not.toContain("Navigation");
  });
});

describe("hasKnowledgeLinkMatch", () => {
  it("matches follow-up pages on a directly mentioned host", () => {
    expect(hasKnowledgeLinkMatch("https://nextjs.org/docs/app/getting-started", ["https://nextjs.org/docs/app"])).toBe(true);
  });
});
