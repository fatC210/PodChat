import { describe, expect, it } from "vitest";
import {
  buildKnowledgeSearchQueries,
  buildKnowledgeSignals,
  extractKnowledgeExcerpt,
  hasKnowledgeLinkMatch,
} from "@/lib/knowledge-base";
import type { ScriptChunk, TranscriptLine } from "@/lib/podchat-data";

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

const scriptChunks: ScriptChunk[] = [
  {
    id: 1,
    text: "The host explains how React Server Components work and cites the Next.js docs for the App Router.",
  },
];

describe("buildKnowledgeSignals", () => {
  it("keeps script-specific terms and explicit links", () => {
    const signals = buildKnowledgeSignals({
      podcastTitle: "Framework Roundtable",
      podcastTopic: "web architecture",
      transcript,
      scriptChunks,
      rawTerms: ["React Server Components", "MCP"],
      rawLinks: [],
    });

    expect(signals.terms).toContain("React Server Components");
    expect(signals.terms).toContain("MCP");
    expect(signals.links).toContain("https://nextjs.org/docs/app");
    expect(signals.terms).not.toContain("podcast");
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
