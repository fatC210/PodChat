import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ListenPage from "@/views/Listen";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

const updatePodcastMock = vi.fn();
const backMock = vi.fn();
const useParamsMock = vi.fn();
const useAppDataMock = vi.fn();
const useI18nMock = vi.fn();
const cloneHostVoiceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => useParamsMock(),
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

vi.mock("@/lib/navigation", () => ({
  useBackNavigation: () => backMock,
}));

vi.mock("@/lib/api", () => ({
  cloneHostVoice: (...args: unknown[]) => cloneHostVoiceMock(...args),
}));

vi.mock("@/components/SummaryButton", () => ({
  default: () => <button type="button">Summary</button>,
}));

vi.mock("@/components/FloatingChat", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  useParamsMock.mockReturnValue({ id: "pod-1" });
  useI18nMock.mockReturnValue({
    t: (key: string) => key,
  });
  useAppDataMock.mockReturnValue({
    podcasts: [buildReadyPodcast()],
    hydrated: true,
    updatePodcast: updatePodcastMock,
  });
});

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Playback Test",
      type: "multi",
      referenceCount: 1,
      sourceFileName: "episode.mp3",
      sourceFileSizeMb: 12.5,
      personaPresetId: "professional",
      personaLocale: "en",
      customPersonality: "",
      customCatchphrases: "",
      customAnswerStyle: "",
    }),
    id: "pod-1",
    duration: "00:20",
    status: "ready",
    aiHost: "Host Alpha",
    aiHostSpeakerId: "speaker-1",
    progressPercent: 50,
    transcript: [
      {
        id: "line-1",
        speakerId: "speaker-1",
        speaker: "Host Alpha",
        color: "text-accent",
        time: "00:00",
        endTime: "00:10",
        text: "First line",
        translation: "First line translated",
      },
      {
        id: "line-2",
        speakerId: "speaker-2",
        speaker: "Guest Beta",
        color: "text-info",
        time: "00:10",
        endTime: "00:20",
        text: "Second line",
        translation: "Second line translated",
      },
    ],
    speakers: [
      {
        id: "speaker-1",
        name: "Host Alpha",
        pct: 50,
        preview: "First line",
        duration: "00:10",
      },
      {
        id: "speaker-2",
        name: "Guest Beta",
        pct: 50,
        preview: "Second line",
        duration: "00:10",
      },
    ],
    summaries: [
      {
        duration: 1,
        emotion: "serious",
        text: "Summary",
      },
    ],
  };
}

function setupMainAudio(container: HTMLElement) {
  const [audio] = Array.from(container.querySelectorAll("audio"));

  if (!(audio instanceof HTMLAudioElement)) {
    throw new Error("Expected the listen page to render a main audio element.");
  }

  let paused = false;
  let ended = false;
  let currentTime = 10;

  Object.defineProperty(audio, "paused", {
    configurable: true,
    get: () => paused,
  });
  Object.defineProperty(audio, "ended", {
    configurable: true,
    get: () => ended,
  });
  Object.defineProperty(audio, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });

  const pauseSpy = vi.fn(() => {
    paused = true;
    fireEvent.pause(audio);
  });
  const playSpy = vi.fn(async () => {
    paused = false;
    fireEvent.play(audio);
    return undefined;
  });

  Object.defineProperty(audio, "pause", {
    configurable: true,
    value: pauseSpy,
  });
  Object.defineProperty(audio, "play", {
    configurable: true,
    value: playSpy,
  });

  return {
    audio,
    pauseSpy,
    playSpy,
    setEnded(value: boolean) {
      ended = value;
    },
  };
}

describe("ListenPage transcript playback controls", () => {
  it("pauses and resumes when the active transcript line is clicked", async () => {
    const { container } = render(<ListenPage />);
    const { pauseSpy, playSpy } = setupMainAudio(container);
    const secondLine = await screen.findByText("Second line");

    await waitFor(() => {
      expect(secondLine.parentElement).toHaveClass("bg-accent/10");
    });

    fireEvent.click(secondLine.parentElement!);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).not.toHaveBeenCalled();

    fireEvent.click(secondLine.parentElement!);

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("still seeks when a non-active transcript line is clicked", async () => {
    const { container } = render(<ListenPage />);
    const { audio, pauseSpy, playSpy } = setupMainAudio(container);
    const firstLine = await screen.findByText("First line");
    const secondLine = await screen.findByText("Second line");

    await waitFor(() => {
      expect(secondLine.parentElement).toHaveClass("bg-accent/10");
    });

    fireEvent.click(firstLine.parentElement!);

    expect(audio.currentTime).toBe(0);
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("seeks instead of toggling playback after the audio has ended", async () => {
    const { container } = render(<ListenPage />);
    const { audio, pauseSpy, playSpy, setEnded } = setupMainAudio(container);
    const secondLine = await screen.findByText("Second line");

    await waitFor(() => {
      expect(secondLine.parentElement).toHaveClass("bg-accent/10");
    });

    setEnded(true);
    fireEvent.click(secondLine.parentElement!);

    expect(audio.currentTime).toBe(10);
    expect(pauseSpy).not.toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });
});
