import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IndexPage from "@/views/Index";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

const pushMock = vi.fn();
const useAppDataMock = vi.fn();
const useI18nMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/app-data", () => ({
  useAppData: () => useAppDataMock(),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => useI18nMock(),
}));

vi.mock("@/components/SummaryButton", () => ({
  default: () => <button type="button">Summary</button>,
}));

describe("IndexPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useI18nMock.mockReturnValue({
      lang: "en",
      t: (key: string) => key,
    });
    useAppDataMock.mockReturnValue({
      podcasts: [buildReadyPodcast()],
      deletePodcast: vi.fn(),
      regeneratePodcast: vi.fn(),
      hydrated: true,
    });
  });

  it("shows the speaker count separately from the AI host and uses a consistent hover gradient", () => {
    const { container } = render(<IndexPage />);

    expect(screen.getByText("2 speakers")).toBeInTheDocument();
    expect(screen.getByText("AI Host")).toBeInTheDocument();
    expect(screen.getByText("Speaker 1")).toBeInTheDocument();

    const hoverLayer = container.querySelector(".bg-gradient-to-r");
    expect(hoverLayer?.className).toContain("from-accent/12");
    expect(hoverLayer?.className).toContain("via-primary/10");
    expect(hoverLayer?.className).not.toContain("from-warning/15");
  });
});

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Home Card Test",
      type: "multi",
      referenceCount: 4,
      sourceFileName: "episode.mp3",
      sourceFileSizeMb: 12,
      personaPresetId: "professional",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    }),
    id: "pod-1",
    status: "ready",
    duration: "12:00",
    aiHost: "Speaker 1",
    color: "from-warning/15 to-primary/10",
    speakers: [
      {
        id: "speaker-1",
        name: "Speaker 1",
        pct: 60,
        preview: "Host intro",
        duration: "07:12",
      },
      {
        id: "speaker-2",
        name: "Speaker 2",
        pct: 40,
        preview: "Guest reply",
        duration: "04:48",
      },
    ],
    transcript: [
      {
        id: "line-1",
        speakerId: "speaker-1",
        speaker: "Speaker 1",
        color: "text-accent",
        time: "00:00",
        text: "Intro",
        translation: "Intro",
      },
      {
        id: "line-2",
        speakerId: "speaker-2",
        speaker: "Speaker 2",
        color: "text-info",
        time: "00:05",
        text: "Reply",
        translation: "Reply",
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
