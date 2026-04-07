"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  MessageCircle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Settings,
  ChevronDown,
  Languages,
  Download,
  Loader2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SummaryButton from "@/components/SummaryButton";
import FloatingChat from "@/components/FloatingChat";
import { cloneHostVoice } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { useBackNavigation } from "@/lib/navigation";
import {
  formatDurationLabel,
  getDominantSpeakerId,
  getPreferredAiHostSpeakerId,
  getTranslatedTranscript,
  isPodcastReady,
  targetLangs,
  timeToSeconds,
  type TranscriptMode,
} from "@/lib/podchat-data";
import { isMediaPlaybackInterruption } from "@/lib/utils";

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function ListenPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const { podcasts, hydrated, updatePodcast } = useAppData();
  const goBack = useBackNavigation("/");
  const podcast = podcasts.find((entry) => entry.id === params.id);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showSpeed, setShowSpeed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>("original");
  const [showTranscriptMenu, setShowTranscriptMenu] = useState(false);
  const [targetLang, setTargetLang] = useState("zh");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [cloningVoice, setCloningVoice] = useState(false);
  const [previewPlayingSpeakerId, setPreviewPlayingSpeakerId] = useState<string | null>(null);
  const [previewLoadingSpeakerId, setPreviewLoadingSpeakerId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const progressRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const transcriptModeRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const previewPlayRequestIdRef = useRef(0);
  const transcriptAutoScrollEnabledRef = useRef(false);
  const initializedPodcastIdRef = useRef<string | null>(null);
  const podcastId = podcast?.id;
  const storedProgress = podcast?.progressPercent ?? 0;
  const storedSpeed = podcast?.speed ?? 1;
  const storedTranscriptMode = podcast?.transcriptMode ?? "original";
  const storedTargetLang = podcast?.targetLang ?? "zh";
  const storedSpeakerFilter = podcast?.speakerFilter ?? null;

  useEffect(() => {
    if (!hydrated || !podcast || !podcastId) {
      return;
    }

    if (initializedPodcastIdRef.current === podcastId) {
      return;
    }

    initializedPodcastIdRef.current = podcastId;
    setPlaying(false);
    setAudioDuration(null);
    setAudioError(null);
    setProgress(podcast.progressPercent ?? 0);
    setCurrentTimeSeconds(((podcast.progressPercent ?? 0) / 100) * (timeToSeconds(podcast.duration) || 0));
    setSpeed(podcast.speed ?? 1);
    setTranscriptMode(podcast.transcriptMode ?? "original");
    setTargetLang(podcast.targetLang ?? "zh");
    setSpeakerFilter(podcast.speakerFilter ?? null);
    setSelectedSpeakerId(getPreferredAiHostSpeakerId(podcast) ?? "");
    transcriptAutoScrollEnabledRef.current = false;
    setVoiceSettingsOpen(false);
    setCloningVoice(false);
    setPreviewPlayingSpeakerId(null);
    setPreviewLoadingSpeakerId(null);
    setPreviewError(null);
    previewPlayRequestIdRef.current += 1;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.removeAttribute("src");
      previewAudioRef.current.dataset.speakerId = "";
      previewAudioRef.current.load();
    }
  }, [hydrated, podcast, podcastId]);

  const totalDuration = useMemo(
    () =>
      typeof audioDuration === "number" && Number.isFinite(audioDuration) && audioDuration > 0
        ? audioDuration
        : podcast
        ? timeToSeconds(podcast.duration)
        : 0,
    [audioDuration, podcast],
  );
  const currentTime = currentTimeSeconds;
  const dominantSpeakerId = useMemo(
    () => (podcast ? getDominantSpeakerId(podcast.speakers) : null),
    [podcast],
  );
  const selectedSpeaker = useMemo(
    () => podcast?.speakers.find((speaker) => speaker.id === selectedSpeakerId) ?? null,
    [podcast, selectedSpeakerId],
  );

  const activeLineIndex = useMemo(() => {
    if (!podcast) {
      return 0;
    }

    return podcast.transcript.reduce((current, line, index) => {
      return timeToSeconds(line.time) <= currentTime ? index : current;
    }, 0);
  }, [currentTime, podcast]);

  useEffect(() => {
    if (!hydrated || !podcastId || initializedPodcastIdRef.current !== podcastId) {
      return;
    }

    const hasChanges =
      progress !== storedProgress ||
      speed !== storedSpeed ||
      transcriptMode !== storedTranscriptMode ||
      targetLang !== storedTargetLang ||
      speakerFilter !== storedSpeakerFilter;

    if (!hasChanges) {
      return;
    }

    updatePodcast(podcastId, (current) => ({
      ...current,
      progressPercent: progress,
      speed,
      transcriptMode,
      targetLang,
      speakerFilter,
    }));
  }, [
    hydrated,
    podcastId,
    progress,
    speed,
    speakerFilter,
    storedProgress,
    storedSpeakerFilter,
    storedSpeed,
    storedTargetLang,
    storedTranscriptMode,
    targetLang,
    transcriptMode,
    updatePodcast,
  ]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (!transcriptAutoScrollEnabledRef.current || !activeLineRef.current) {
      return;
    }

    activeLineRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeLineIndex]);

  useEffect(() => {
    const anyOpen = showSpeed || showExportMenu || showTranscriptMenu || showLangMenu;
    if (!anyOpen) {
      return;
    }

    const handler = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showSpeed && speedRef.current && !speedRef.current.contains(target)) {
        setShowSpeed(false);
      }
      if (showExportMenu && exportRef.current && !exportRef.current.contains(target)) {
        setShowExportMenu(false);
      }
      if (showTranscriptMenu && transcriptModeRef.current && !transcriptModeRef.current.contains(target)) {
        setShowTranscriptMenu(false);
      }
      if (showLangMenu && langRef.current && !langRef.current.contains(target)) {
        setShowLangMenu(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu, showLangMenu, showSpeed, showTranscriptMenu]);

  const handleProgressClick = (event: React.MouseEvent) => {
    if (!progressRef.current || totalDuration === 0) {
      return;
    }

    transcriptAutoScrollEnabledRef.current = true;
    const rect = progressRef.current.getBoundingClientRect();
    const nextProgress = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const audio = audioRef.current;
    const nextTime = (nextProgress / 100) * totalDuration;

    if (audio) {
      audio.currentTime = nextTime;
    }

    setCurrentTimeSeconds(nextTime);
    setProgress(nextProgress);
  };

  const handleProgressDrag = (event: React.MouseEvent) => {
    if (event.buttons !== 1 || !progressRef.current || totalDuration === 0) {
      return;
    }

    transcriptAutoScrollEnabledRef.current = true;
    const rect = progressRef.current.getBoundingClientRect();
    const nextProgress = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const audio = audioRef.current;
    const nextTime = (nextProgress / 100) * totalDuration;

    if (audio) {
      audio.currentTime = nextTime;
    }

    setCurrentTimeSeconds(nextTime);
    setProgress(nextProgress);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportTxt = () => {
    if (!podcast) {
      return;
    }

    const content = podcast.transcript
      .map((line) => `[${line.time}] ${line.speaker}: ${line.text}`)
      .join("\n\n");
    downloadFile(content, `${podcast.id}-transcript.txt`);
    setShowExportMenu(false);
  };

  const exportSrt = () => {
    if (!podcast) {
      return;
    }

    const content = podcast.transcript
      .map((line, index) => {
        const start = timeToSeconds(line.time);
        const end =
          index < podcast.transcript.length - 1
            ? timeToSeconds(podcast.transcript[index + 1].time)
            : start + 10;

        const pad = (value: number) => value.toString().padStart(2, "0");
        const asSrt = (value: number) =>
          `${pad(Math.floor(value / 3600))}:${pad(Math.floor((value % 3600) / 60))}:${pad(
            value % 60,
          )},000`;

        return `${index + 1}\n${asSrt(start)} --> ${asSrt(end)}\n${line.speaker}: ${line.text}`;
      })
      .join("\n\n");

    downloadFile(content, `${podcast.id}-transcript.srt`);
    setShowExportMenu(false);
  };

  const exportVtt = () => {
    if (!podcast) {
      return;
    }

    const content = podcast.transcript
      .map((line, index) => {
        const start = timeToSeconds(line.time);
        const end =
          index < podcast.transcript.length - 1
            ? timeToSeconds(podcast.transcript[index + 1].time)
            : start + 10;

        const pad = (value: number) => value.toString().padStart(2, "0");
        const asVtt = (value: number) =>
          `${pad(Math.floor(value / 3600))}:${pad(Math.floor((value % 3600) / 60))}:${pad(
            value % 60,
          )}.000`;

        return `${asVtt(start)} --> ${asVtt(end)}\n${line.speaker}: ${line.text}`;
      })
      .join("\n\n");

    downloadFile(`WEBVTT\n\n${content}`, `${podcast.id}-transcript.vtt`);
    setShowExportMenu(false);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      try {
        previewAudioRef.current?.pause();
        await audio.play();
      } catch {
        setAudioError("Audio playback could not start.");
      }
      return;
    }

    audio.pause();
  };

  const handleTranscriptLineClick = async (lineTime: string, isActive: boolean) => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    transcriptAutoScrollEnabledRef.current = true;

    if (isActive && !audio.ended) {
      await togglePlayback();
      return;
    }

    if (totalDuration === 0) {
      return;
    }

    const nextTime = timeToSeconds(lineTime);
    audio.currentTime = nextTime;
    setCurrentTimeSeconds(nextTime);
    setProgress((nextTime / totalDuration) * 100);
  };

  const toggleSpeakerPreview = async (speakerId: string) => {
    const previewAudio = previewAudioRef.current;

    if (!podcast || !previewAudio) {
      return;
    }

    if (previewPlayingSpeakerId === speakerId) {
      previewPlayRequestIdRef.current += 1;
      previewAudio.pause();
      return;
    }

    const requestId = previewPlayRequestIdRef.current + 1;
    previewPlayRequestIdRef.current = requestId;
    setPreviewError(null);
    setPreviewLoadingSpeakerId(speakerId);

    try {
      audioRef.current?.pause();
      const currentSpeakerId = previewAudio.dataset.speakerId;

      if (currentSpeakerId !== speakerId) {
        previewAudio.pause();
        previewAudio.src = `/api/podcasts/${podcast.id}/speaker-preview?speakerId=${encodeURIComponent(speakerId)}`;
        previewAudio.dataset.speakerId = speakerId;
      } else if (previewAudio.ended) {
        previewAudio.currentTime = 0;
      }

      await previewAudio.play();
    } catch (error) {
      if (previewPlayRequestIdRef.current !== requestId || isMediaPlaybackInterruption(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : t("listen.previewUnavailable");
      setPreviewError(message);
      setPreviewPlayingSpeakerId(null);
      toast.error(message);
    } finally {
      if (previewPlayRequestIdRef.current === requestId) {
        setPreviewLoadingSpeakerId((current) => (current === speakerId ? null : current));
      }
    }
  };

  const handleCloneVoice = async () => {
    if (!podcast || !selectedSpeakerId || cloningVoice) {
      return;
    }

    setCloningVoice(true);
    setPreviewError(null);
    previewAudioRef.current?.pause();

    try {
      const result = await cloneHostVoice(podcast.id, selectedSpeakerId);
      updatePodcast(podcast.id, (current) => ({
        ...result.podcast,
        progressPercent: current.progressPercent,
        speed: current.speed,
        transcriptMode: current.transcriptMode,
        targetLang: current.targetLang,
        speakerFilter: current.speakerFilter,
      }));
      setSelectedSpeakerId(result.podcast.aiHostSpeakerId ?? selectedSpeakerId);
      toast.success(t("podSettings.voiceUpdated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("podSettings.voiceUpdateFailed"));
    } finally {
      setCloningVoice(false);
    }
  };

  if (!hydrated) {
    return <div className="max-w-screen-lg mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!podcast) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 py-10">
        <p className="text-lg font-semibold text-foreground">Podcast not found</p>
        <button onClick={goBack} className="text-sm text-accent hover:underline mt-3 inline-block">
          {t("nav.back")}
        </button>
      </div>
    );
  }

  if (!isPodcastReady(podcast)) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold text-foreground">{t("podcast.notReadyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("podcast.notReadyDesc")}</p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t("nav.back")}
            </button>
            <Link
              href={`/podcast/${podcast.id}/settings`}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              {t("nav.settings")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const transcriptModes: { key: TranscriptMode; label: string }[] = [
    { key: "original", label: t("listen.modeOriginal") },
    { key: "translated", label: t("listen.modeTranslated") },
    { key: "trans-top", label: t("listen.modeTransTop") },
    { key: "trans-bottom", label: t("listen.modeTransBottom") },
  ];

  const filteredTranscript = podcast.transcript.filter(
    (line) => !speakerFilter || line.speaker === speakerFilter,
  );

  const voiceSettingsSection = (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("podSettings.aiHostVoice")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
              {t("podSettings.currentAiHost", {
                name: podcast.aiHost ?? t("podSettings.notAssigned"),
              })}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
              {t("podSettings.currentVoice", {
                name: podcast.aiHostVoiceName ?? t("podSettings.notClonedYet"),
              })}
            </span>
            {selectedSpeaker && (
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-accent">
                {t("listen.selectedHost")}: {selectedSpeaker.name}
              </span>
            )}
          </div>

          {previewError && <p className="text-xs text-destructive">{previewError}</p>}
        </div>

        <button
          type="button"
          onClick={() => setVoiceSettingsOpen((current) => !current)}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors shrink-0"
          aria-expanded={voiceSettingsOpen}
        >
          {voiceSettingsOpen ? t("listen.hideVoiceSettings") : t("listen.manageVoice")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${voiceSettingsOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {voiceSettingsOpen && (
        <div className="mt-4 border-t border-border/70 pt-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            {podcast.speakers.map((speaker) => {
              const isSelected = selectedSpeakerId === speaker.id;
              const isCurrentHost = podcast.aiHostSpeakerId === speaker.id;
              const isRecommended = dominantSpeakerId === speaker.id;
              const isPreviewLoading = previewLoadingSpeakerId === speaker.id;
              const isPreviewPlaying = previewPlayingSpeakerId === speaker.id;

              return (
                <div
                  key={speaker.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedSpeakerId(speaker.id);
                    setPreviewError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedSpeakerId(speaker.id);
                      setPreviewError(null);
                    }
                  }}
                  className={`rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/5"
                      : "border-border bg-background/40 hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{speaker.name}</p>
                        {isCurrentHost && (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                            {t("listen.currentHost")}
                          </span>
                        )}
                        {isRecommended && (
                          <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
                            {t("listen.recommendedHost")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{speaker.preview}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">{speaker.pct}%</p>
                      <p className="text-[11px] text-muted-foreground">{speaker.duration}</p>
                    </div>
                  </div>

                  <div className={`mt-3 flex items-center gap-3 ${isSelected ? "justify-between" : "justify-end"}`}>
                    {isSelected && (
                      <span className="text-xs font-medium text-accent">
                        {t("listen.selectedHost")}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleSpeakerPreview(speaker.id);
                      }}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                    >
                      {isPreviewLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isPreviewPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {t("wizard.host.preview")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void handleCloneVoice()}
              disabled={!selectedSpeakerId || cloningVoice}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {cloningVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              {t("podSettings.cloneHostVoice")}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6">
      <audio
        ref={audioRef}
        src={`/api/podcasts/${podcast.id}/asset`}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
          const nextCurrentTime = ((podcast.progressPercent ?? 0) / 100) * nextDuration;

          setAudioDuration(nextDuration > 0 ? nextDuration : null);
          setAudioError(null);

          if (nextDuration > 0 && Math.abs(audio.currentTime - nextCurrentTime) > 0.5) {
            audio.currentTime = nextCurrentTime;
          }

          setCurrentTimeSeconds(nextCurrentTime);
          setProgress(nextDuration > 0 ? (nextCurrentTime / nextDuration) * 100 : podcast.progressPercent ?? 0);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          const nextDuration = Number.isFinite(audio.duration) ? audio.duration : totalDuration;
          const nextCurrentTime = audio.currentTime;
          setCurrentTimeSeconds(nextCurrentTime);
          if (nextDuration > 0) {
            setProgress((nextCurrentTime / nextDuration) * 100);
          }
        }}
        onPlay={() => {
          previewAudioRef.current?.pause();
          transcriptAutoScrollEnabledRef.current = true;
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTimeSeconds(totalDuration);
          setProgress(100);
        }}
        onError={() => {
          setPlaying(false);
          setAudioError("The uploaded source file could not be played in this browser.");
        }}
      />
      <audio
        ref={previewAudioRef}
        preload="none"
        onPlay={(event) => {
          setPreviewError(null);
          setPreviewLoadingSpeakerId(null);
          setPreviewPlayingSpeakerId(event.currentTarget.dataset.speakerId || null);
        }}
        onPause={() => setPreviewPlayingSpeakerId(null)}
        onEnded={() => setPreviewPlayingSpeakerId(null)}
        onError={() => {
          setPreviewLoadingSpeakerId(null);
          setPreviewPlayingSpeakerId(null);
          setPreviewError(t("listen.previewUnavailable"));
        }}
      />

      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goBack}
            className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground shrink-0"
            aria-label={t("nav.back")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground truncate">{podcast.title}</h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setChatOpen(true)}
            className="h-8 px-3 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm inline-flex items-center gap-1.5"
          >
            <MessageCircle className="h-3.5 w-3.5" /> {t("home.chat")}
          </button>
          <SummaryButton podcastId={podcast.id} />
          <Link
            href={`/podcast/${podcast.id}/settings`}
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
          >
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-card border border-border p-4">
          {audioError && (
            <p className="mb-3 text-xs text-destructive">{audioError}</p>
          )}
          <div className="flex items-end justify-center gap-[3px] h-14 mb-3">
            {Array.from({ length: 40 }).map((_, index) => {
              const isPlayed = (index / 40) * 100 < progress;
              const baseHeight = 20 + Math.sin(index * 0.6) * 14 + Math.cos(index * 0.3) * 8;
              return (
                <div
                  key={index}
                  className={`w-[3px] rounded-t-full transition-colors duration-200 origin-bottom ${
                    isPlayed ? "bg-accent" : "bg-muted-foreground/20"
                  }`}
                  style={{
                    height: `${baseHeight}%`,
                    ...(playing
                      ? {
                          animationName: "waveGrow",
                          animationDuration: "1.2s",
                          animationTimingFunction: "ease-in-out",
                          animationIterationCount: "infinite",
                          animationDirection: "alternate",
                          animationDelay: `${-index * 60}ms`,
                        }
                      : {}),
                  }}
                />
              );
            })}
          </div>

          <div className="mb-4">
            <div
              ref={progressRef}
              className="w-full h-1.5 bg-secondary rounded-full cursor-pointer group relative"
              onClick={handleProgressClick}
              onMouseMove={handleProgressDrag}
            >
              <div className="h-full bg-accent rounded-full relative" style={{ width: `${progress}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-accent border-2 border-background shadow-md scale-0 group-hover:scale-100 transition-transform" />
              </div>
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatDurationLabel(Math.floor(currentTime))}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{podcast.duration}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-5">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const audio = audioRef.current;

                      if (!audio) {
                        return;
                      }

                      transcriptAutoScrollEnabledRef.current = true;
                      audio.currentTime = Math.max(0, audio.currentTime - 10);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>-10s</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              onClick={() => void togglePlayback()}
              className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const audio = audioRef.current;

                      if (!audio) {
                        return;
                      }

                      transcriptAutoScrollEnabledRef.current = true;
                      audio.currentTime = Math.min(totalDuration, audio.currentTime + 10);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>+10s</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="relative" ref={speedRef}>
              <button
                onClick={() => setShowSpeed((current) => !current)}
                className="h-7 px-3 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1"
              >
                {speed}x <ChevronDown className="h-3 w-3" />
              </button>
              {showSpeed && (
                <div className="absolute bottom-full mb-2 right-0 bg-card border border-border rounded-2xl p-1.5 shadow-lg min-w-[72px] animate-scale-in">
                  {speeds.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSpeed(value);
                        setShowSpeed(false);
                      }}
                      className={`w-full px-3 py-1.5 text-xs text-center font-medium rounded-full transition-colors ${
                        speed === value
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {voiceSettingsSection}

        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("listen.transcript")}
              </p>
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setShowExportMenu((current) => !current)}
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {showExportMenu && (
                  <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl py-1 shadow-lg min-w-[80px] z-10 animate-scale-in">
                    <button
                      onClick={exportTxt}
                      className="block w-full px-3 py-1.5 text-[11px] text-left text-foreground hover:bg-secondary transition-colors"
                    >
                      .txt
                    </button>
                    <button
                      onClick={exportSrt}
                      className="block w-full px-3 py-1.5 text-[11px] text-left text-foreground hover:bg-secondary transition-colors"
                    >
                      .srt
                    </button>
                    <button
                      onClick={exportVtt}
                      className="block w-full px-3 py-1.5 text-[11px] text-left text-foreground hover:bg-secondary transition-colors"
                    >
                      .vtt
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {transcriptMode !== "original" && (
                <div className="relative" ref={langRef}>
                  <button
                    onClick={() => setShowLangMenu((current) => !current)}
                    className="h-7 px-2.5 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    {targetLangs.find((lang) => lang.code === targetLang)?.label}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showLangMenu && (
                    <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl py-1 shadow-lg min-w-[100px] z-10 animate-scale-in">
                      {targetLangs.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setTargetLang(lang.code);
                            setShowLangMenu(false);
                          }}
                          className={`block w-full px-3 py-1.5 text-[11px] text-left transition-colors ${
                            targetLang === lang.code
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="relative" ref={transcriptModeRef}>
                <button
                  onClick={() => setShowTranscriptMenu((current) => !current)}
                  className="h-7 px-2.5 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Languages className="h-3 w-3" />
                  {transcriptModes.find((mode) => mode.key === transcriptMode)?.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showTranscriptMenu && (
                  <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl p-1 shadow-lg min-w-[140px] z-10 animate-scale-in">
                    {transcriptModes.map((mode) => (
                      <button
                        key={mode.key}
                        onClick={() => {
                          setTranscriptMode(mode.key);
                          setShowTranscriptMenu(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-[11px] rounded-lg text-left transition-colors ${
                          transcriptMode === mode.key
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <button
              onClick={() => setSpeakerFilter(null)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                !speakerFilter
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {podcast.speakers.map((speaker) => (
              <button
                key={speaker.id}
                onClick={() =>
                  setSpeakerFilter((current) => (current === speaker.name ? null : speaker.name))
                }
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                  speakerFilter === speaker.name
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {speaker.name}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredTranscript.map((line) => {
              const originalIndex = podcast.transcript.findIndex((entry) => entry.id === line.id);
              const isActive = originalIndex === activeLineIndex;
              const translated = getTranslatedTranscript(line, targetLang);

              return (
                <div
                  key={line.id}
                  ref={isActive ? activeLineRef : undefined}
                  onClick={() => void handleTranscriptLineClick(line.time, isActive)}
                  className={`cursor-pointer -mx-2 px-2 py-1.5 rounded-lg transition-all duration-300 ${
                    isActive
                      ? "bg-accent/10 border-l-2 border-accent pl-3"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[11px] font-semibold ${line.color}`}>{line.speaker}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{line.time}</span>
                  </div>
                  {transcriptMode === "original" && (
                    <p className="text-[13px] text-foreground leading-relaxed">{line.text}</p>
                  )}
                  {transcriptMode === "translated" && (
                    <p className="text-[13px] text-foreground leading-relaxed">{translated}</p>
                  )}
                  {transcriptMode === "trans-top" && (
                    <>
                      <p className="text-[13px] text-foreground leading-relaxed">{translated}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">{line.text}</p>
                    </>
                  )}
                  {transcriptMode === "trans-bottom" && (
                    <>
                      <p className="text-[13px] text-foreground leading-relaxed">{line.text}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">{translated}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {!chatOpen && (
        <div className="fixed bottom-5 right-5 z-30">
          <button
            onClick={() => setChatOpen(true)}
            aria-label={t("home.chat")}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl shadow-accent/30 transition-all hover:scale-[1.03] hover:opacity-95"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      <FloatingChat open={chatOpen} onClose={() => setChatOpen(false)} podcast={podcast} />
    </div>
  );
}
