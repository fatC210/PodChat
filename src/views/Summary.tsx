"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Play, Pause, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { requestSummaryAudio, requestSummaryTranslation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { useBackNavigation } from "@/lib/navigation";
import { isMediaPlaybackInterruption } from "@/lib/utils";
import {
  formatDurationLabel,
  getSummary,
  getSummaryTranslation,
  isPodcastReady,
  summaryDurations,
  summaryEmotions,
  summaryEmotionClasses,
  targetLangs,
  type SummaryEmotion,
  setPodcastSummaryEmotion,
  upsertSummaryTranslation,
} from "@/lib/podchat-data";

type SummaryMode = "original" | "translated";

export default function SummaryPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { podcasts, hydrated, updatePodcast } = useAppData();
  const goBack = useBackNavigation("/");
  const podcast = podcasts.find((entry) => entry.id === params.id);
  const [duration, setDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("original");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showTranslatedSubmenu, setShowTranslatedSubmenu] = useState(false);
  const [targetLang, setTargetLang] = useState("zh");
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const durationRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const summaryAudioUrlRef = useRef<string | null>(null);
  const playRequestIdRef = useRef(0);
  const pendingPlayRef = useRef(false);
  const [summaryAudioSrc, setSummaryAudioSrc] = useState<string | null>(null);

  const revokeSummaryAudioUrl = useCallback(() => {
    if (summaryAudioUrlRef.current) {
      URL.revokeObjectURL(summaryAudioUrlRef.current);
      summaryAudioUrlRef.current = null;
    }
  }, []);

  const resetAudioPlayback = () => {
    playRequestIdRef.current += 1;
    pendingPlayRef.current = false;
    audioRef.current?.pause();
    setPlaying(false);
    setAudioDuration(null);
    setAudioError(null);
    setProgress(0);
  };

  useEffect(() => {
    const anyMenuOpen = showDurationMenu || showModeMenu;

    if (!anyMenuOpen) {
      return;
    }

    const handler = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showDurationMenu && durationRef.current && !durationRef.current.contains(target)) {
        setShowDurationMenu(false);
      }

      if (showModeMenu && modeRef.current && !modeRef.current.contains(target)) {
        setShowModeMenu(false);
        setShowTranslatedSubmenu(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDurationMenu, showModeMenu]);

  useEffect(() => {
    if (!showModeMenu) {
      setShowTranslatedSubmenu(false);
    }
  }, [showModeMenu]);

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      playRequestIdRef.current += 1;
      pendingPlayRef.current = false;
      audio?.pause();
      revokeSummaryAudioUrl();
    };
  }, [revokeSummaryAudioUrl]);

  useEffect(() => {
    if (!podcast) {
      return;
    }

    const nextDuration = Number(searchParams.get("dur"));

    if (nextDuration && summaryDurations.includes(nextDuration as (typeof summaryDurations)[number])) {
      playRequestIdRef.current += 1;
      pendingPlayRef.current = false;
      audioRef.current?.pause();
      setPlaying(false);
      setAudioDuration(null);
      setAudioError(null);
      setProgress(0);
      setDuration(nextDuration);
    }
  }, [podcast, searchParams]);

  useEffect(() => {
    if (!podcast) {
      return;
    }

    setTargetLang(podcast.targetLang ?? "zh");
  }, [podcast]);

  const summary = useMemo(
    () => (podcast && duration ? getSummary(podcast, duration) : null),
    [duration, podcast],
  );

  const cachedTranslation = useMemo(
    () => (summary ? getSummaryTranslation(summary, targetLang) : null),
    [summary, targetLang],
  );

  useEffect(() => {
    if (summaryMode !== "translated") {
      setTranslationText(null);
      setTranslationLoading(false);
      setTranslationError(null);
      return;
    }

    setTranslationText(cachedTranslation);
    setTranslationError(null);

    if (!podcast || !summary || cachedTranslation) {
      setTranslationLoading(false);
      return;
    }

    let cancelled = false;
    setTranslationLoading(true);

    void requestSummaryTranslation(podcast.id, summary.duration, targetLang)
      .then((result) => {
        if (cancelled) {
          return;
        }

        const nextText = result.text.trim();
        setTranslationText(nextText || null);

        if (!nextText) {
          return;
        }

        updatePodcast(podcast.id, (currentPodcast) => ({
          ...currentPodcast,
          targetLang,
          summaries: currentPodcast.summaries.map((entry) =>
            entry.duration === summary.duration
              ? upsertSummaryTranslation(entry, targetLang, nextText)
              : entry,
          ),
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : t("summary.translationFailed");
        setTranslationError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) {
          setTranslationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cachedTranslation, podcast, summary, summaryMode, t, targetLang, updatePodcast]);

  const displayText =
    summaryMode === "translated"
      ? translationText ?? summary?.text ?? ""
      : summary?.text ?? "";
  useEffect(() => {
    revokeSummaryAudioUrl();
    setSummaryAudioSrc(null);

    if (!podcast || !summary || !duration) {
      return;
    }

    let cancelled = false;

    void requestSummaryAudio(
      podcast.id,
      duration,
      summary.emotion,
      summaryMode === "translated" ? targetLang : undefined,
    )
      .then((blob) => {
        if (cancelled) {
          return;
        }

        const nextUrl = URL.createObjectURL(blob);
        summaryAudioUrlRef.current = nextUrl;
        setSummaryAudioSrc(nextUrl);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "ElevenLabs summary audio is unavailable.";
        setAudioError(message);
      });

    return () => {
      cancelled = true;
      revokeSummaryAudioUrl();
    };
  }, [duration, podcast, revokeSummaryAudioUrl, summary, summaryMode, targetLang]);
  const selectedLangLabel = targetLangs.find((lang) => lang.code === targetLang)?.label ?? targetLang.toUpperCase();
  const selectedModeLabel =
    summaryMode === "translated"
      ? selectedLangLabel
      : t("listen.modeOriginal");

  const handleSelectDuration = (value: number) => {
    if (!podcast) {
      return;
    }

    resetAudioPlayback();
    setDuration(value);
    setShowDurationMenu(false);
    setTranslationError(null);
  };

  const handleSelectSummaryMode = (value: SummaryMode, nextTargetLang?: string) => {
    if (!podcast) {
      return;
    }

    resetAudioPlayback();

    if (value === "translated" && nextTargetLang) {
      setTargetLang(nextTargetLang);
      setTranslationError(null);
      updatePodcast(podcast.id, (currentPodcast) => ({
        ...currentPodcast,
        targetLang: nextTargetLang,
      }));
    }

    setSummaryMode(value);
    setShowModeMenu(false);
    setShowTranslatedSubmenu(false);
  };

  const handleSelectEmotion = (emotion: SummaryEmotion) => {
    if (!podcast || !summary || summary.emotion === emotion) {
      return;
    }

    resetAudioPlayback();
    updatePodcast(podcast.id, (currentPodcast) => ({
      ...currentPodcast,
      summaries: setPodcastSummaryEmotion(currentPodcast.summaries, emotion),
    }));
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio || !summary || !duration) {
      return;
    }

    if (pendingPlayRef.current || !audio.paused) {
      playRequestIdRef.current += 1;
      pendingPlayRef.current = false;
      audio.pause();
      return;
    }

    const requestId = playRequestIdRef.current + 1;
    playRequestIdRef.current = requestId;
    pendingPlayRef.current = true;
    setAudioError(null);

    try {
      await audio.play();
    } catch (error) {
      if (playRequestIdRef.current !== requestId || isMediaPlaybackInterruption(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Summary audio could not start.";
      setAudioError(message);
      toast.error(message);
    } finally {
      if (playRequestIdRef.current === requestId) {
        pendingPlayRef.current = false;
      }
    }
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
          key={summaryAudioSrc ?? `${podcast.id}-${duration}-${summaryMode === "translated" ? targetLang : "original"}-${summary.emotion}`}
          ref={audioRef}
          src={summaryAudioSrc ?? undefined}
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
          onPlay={() => {
            pendingPlayRef.current = false;
            setPlaying(true);
          }}
          onPause={() => {
            pendingPlayRef.current = false;
            setPlaying(false);
          }}
          onEnded={() => {
            pendingPlayRef.current = false;
            setPlaying(false);
            setProgress(100);
          }}
          onError={() => {
            playRequestIdRef.current += 1;
            pendingPlayRef.current = false;
            setPlaying(false);
            const message = "ElevenLabs summary audio is unavailable.";
            setAudioError(message);
          }}
        />
      )}

      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
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

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="relative" ref={modeRef}>
            <button
              onClick={() => {
                setShowModeMenu((current) => !current);
                setShowTranslatedSubmenu(false);
              }}
              className="h-8 px-3 rounded-full bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors inline-flex items-center gap-1.5"
            >
              {selectedModeLabel}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showModeMenu && (
              <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-2xl p-1.5 shadow-lg min-w-[120px] z-10 animate-scale-in">
                <button
                  onClick={() => handleSelectSummaryMode("original")}
                  className={`block w-full px-3 py-1.5 text-xs text-left font-medium rounded-full transition-colors ${
                    summaryMode === "original"
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {t("listen.modeOriginal")}
                </button>
                <div
                  className="relative"
                  onMouseEnter={() => setShowTranslatedSubmenu(true)}
                  onMouseLeave={() => setShowTranslatedSubmenu(false)}
                >
                  <button
                    onClick={() => setShowTranslatedSubmenu((current) => !current)}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-xs text-left font-medium rounded-full transition-colors ${
                      showTranslatedSubmenu
                        ? "bg-secondary text-foreground"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    {t("listen.modeTranslated")}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                  {showTranslatedSubmenu && (
                    <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-2xl p-1.5 shadow-lg min-w-[112px] z-20 animate-scale-in">
                      {targetLangs.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => handleSelectSummaryMode("translated", lang.code)}
                          className={`block w-full px-3 py-1.5 text-xs text-left font-medium rounded-full transition-colors ${
                            summaryMode === "translated" && targetLang === lang.code
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
      </div>

      {summary ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{t("summary.emotionLabel")}</span>
            {summaryEmotions.map((emotion) => (
              <button
                key={emotion}
                onClick={() => handleSelectEmotion(emotion)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  summary.emotion === emotion
                    ? `${summaryEmotionClasses[emotion]} border-current`
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {t(`summary.emotions.${emotion}` as never)}
              </button>
            ))}
            {summaryMode === "translated" && (
              <span className="text-xs text-muted-foreground">
                {selectedLangLabel}
                {translationLoading ? ` - ${t("summary.translationLoading")}` : ""}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            {translationError && (
              <p className="mb-3 text-xs text-destructive">{translationError}</p>
            )}
            <p className="whitespace-pre-line text-sm leading-7 text-foreground/85">{displayText}</p>
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
