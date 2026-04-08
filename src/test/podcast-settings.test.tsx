import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PodcastSettingsPage from "@/views/PodcastSettings";
import { buildPodcastFromWizard, type Podcast } from "@/lib/podchat-data";

const pushMock = vi.fn();
const goBackMock = vi.fn();
const updatePodcastMock = vi.fn();
const deletePodcastMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const useAppDataMock = vi.fn();
const useI18nMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({
    id: "pod-1",
  }),
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/navigation", () => ({
  useBackNavigation: () => goBackMock,
}));

vi.mock("@/lib/app-data", () => ({
  useAppData: () => useAppDataMock(),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => useI18nMock(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe("PodcastSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useI18nMock.mockReturnValue({
      t: (key: string) =>
        (
          {
            "settings.saved": "Settings saved",
            "wizard.podcastTitle": "Podcast title",
            "podSettings.podcastTitleRequired": "Podcast title cannot be empty.",
          } as Record<string, string>
        )[key] ?? key,
    });
    useAppDataMock.mockReturnValue({
      podcasts: [buildReadyPodcast()],
      hydrated: true,
      updatePodcast: updatePodcastMock,
      deletePodcast: deletePodcastMock,
    });
  });

  it("allows editing the podcast title from settings", () => {
    render(<PodcastSettingsPage />);

    const titleInput = screen.getByLabelText("Podcast title");
    fireEvent.change(titleInput, { target: { value: "Updated Settings Title" } });
    fireEvent.blur(titleInput);

    expect(updatePodcastMock).toHaveBeenCalledTimes(1);
    expect(updatePodcastMock).toHaveBeenCalledWith("pod-1", expect.any(Function));
    expect(toastSuccessMock).toHaveBeenCalledWith("Settings saved");

    const updater = updatePodcastMock.mock.calls[0]?.[1] as (podcast: Podcast) => Podcast;
    const updatedPodcast = updater(buildReadyPodcast());

    expect(updatedPodcast.title).toBe("Updated Settings Title");
  });

  it("rejects an empty podcast title", () => {
    render(<PodcastSettingsPage />);

    const titleInput = screen.getByLabelText("Podcast title");
    fireEvent.change(titleInput, { target: { value: "   " } });
    fireEvent.blur(titleInput);

    expect(updatePodcastMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Podcast title cannot be empty.");
    expect(titleInput).toHaveValue("Settings Page Title");
  });
});

function buildReadyPodcast(): Podcast {
  return {
    ...buildPodcastFromWizard({
      title: "Settings Page Title",
      type: "multi",
      referenceCount: 2,
      sourceFileName: "settings.mp3",
      sourceFileSizeMb: 8,
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
