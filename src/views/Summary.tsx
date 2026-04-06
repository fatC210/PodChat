"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Play, Pause, ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { useBackNavigation } from "@/lib/navigation";
import { formatDurationLabel, getSummary, isPodcastReady, summaryDurations, summaryEmotionClasses } from "@/lib/podchat-data";

export default function SummaryPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { podcasts, hydrated } = useAppData();
  const goBack = useBackNavigation("/");
  const podcast = podcasts.find((entry) => entry.id === params.id);
  const [duration, setDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const durationRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!showDurationMenu) {
      return;
    }

    const handler = (event: MouseEvent) => {
      if (durationRef.current && !durationRef.current.contains(event.target as Node)) {
        setShowDurationMenu(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDurationMenu]);

  useEffect(() => {
    if (!podcast) {
      return;
    }

    const nextDuration = Number(searchParams.get("dur"));
    if (nextDuration && summaryDurations.includes(nextDuration as (typeof summaryDurations)[number])) {
      setDuration(nextDuration);
      setProgress(0);
      setPlaying(false);
      setAudioDuration(null);
      setAudioError(null);
    }
  }, [podcast, searchParams]);

  const summary = useMemo(
    () => (podcast && duration ? getSummary(podcast, duration) : null),
    [duration, podcast],
  );

  const handleSelectDuration = (value: number) => {
    if (!podcast) {
      return;
    }

    setDuration(value);
    setShowDurationMenu(false);
    setProgress(0);
    setPlaying(false);
    setAudioDuration(null);
    setAudioError(null);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio || !summary || !duration) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Summary audio could not start.";
        setAudioError(message);
        toast.error(message);
      }
      return;
    }

    audio.pause();
  };

  if (!hydrated) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!podcast) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-lg font-semibold text-foreground">Podcast not found</p>
      </div>
    );
  }

  if (!isPodcastReady(podcast)) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold text-foreground">{t("podcast.notReadyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("podcast.notReadyDesc")}</p>
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity mt-6"
          >
            {t("nav.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {summary && duration && (
        <audio
          key={`${podcast.id}-${duration}`}
          ref={audioRef}
          src={`/api/podcasts/${podcast.id}/summary-audio?dur=${duration}`}
          preload="none"
          onLoadedMetadata={(event) => {
            const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
            setAudioDuration(nextDuration > 0 ? nextDuration : null);
            setAudioError(null);
          }}
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;
            const nextDuration = Number.isFinite(audio.duration) ? audio.duration : audioDuration ?? 0;

            if (nextDuration > 0) {
              setProgress((audio.currentTime / nextDuration) * 100);
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(100);
          }}
          onError={() => {
            setPlaying(false);
            const message = "ElevenLabs summary audio is unavailable.";
            setAudioError(message);
          }}
        />
      )}

      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("nav.back")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">{t("summary.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{podcast.title}</p>
        </div>

        <div className="relative" ref={durationRef}>
          <button
            onClick={() => setShowDurationMenu((current) => !current)}
            className="h-8 px-4 rounded-full bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm inline-flex items-center gap-1.5"
          >
            {duration ? t("summary.min", { n: duration.toString() }) : t("summary.selectDuration")}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showDurationMenu && (
            <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-2xl p-1.5 shadow-lg min-w-[100px] z-10 animate-scale-in">
              {summaryDurations.map((value) => (
                <button
                  key={value}
                  onClick={() => handleSelectDuration(value)}
                  className={`block w-full px-3 py-1.5 text-xs text-center font-medium rounded-full transition-colors ${
                    duration === value ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {t("summary.min", { n: value.toString() })}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {summary ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${summaryEmotionClasses[summary.emotion]}`}
            >
              {t(`summary.emotions.${summary.emotion}` as never)}
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="whitespace-pre-line text-sm leading-7 text-foreground/85">{summary.text}</p>
          </div>

          <div className="rounded-2xl bg-card border border-border p-4">
            {audioError && (
              <p className="mb-3 text-xs text-destructive">{audioError}</p>
            )}
            <div
              className="w-full h-1 bg-secondary rounded-full cursor-pointer mb-3"
              onClick={(event) => {
                const audio = audioRef.current;
                const nextDuration = audioDuration ?? audio?.duration ?? 0;

                if (!audio || !Number.isFinite(nextDuration) || nextDuration <= 0) {
                  return;
                }

                const rect = event.currentTarget.getBoundingClientRect();
                const nextProgress = ((event.clientX - rect.left) / rect.width) * 100;
                audio.currentTime = (nextProgress / 100) * nextDuration;
                setProgress(nextProgress);
              }}
            >
              <div className="h-full bg-accent rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatDurationLabel(
                  Math.floor((((audioDuration ?? (duration ?? 0) * 60) || 0) * progress) / 100),
                )}
              </span>
              <button
                onClick={() => void togglePlayback()}
                className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatDurationLabel(Math.floor(audioDuration ?? (duration ?? 0) * 60))}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground">
            {duration ? t("summary.unavailable") : t("summary.selectDuration")}
          </p>
        </div>
      )}
    </div>
  );
}
