"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Clock, User, Radio, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import SummaryButton from "@/components/SummaryButton";
import { useAppData } from "@/lib/app-data";
import {
  canRegeneratePodcast,
  getPodcastWorkflowIndex,
  getPodcastWorkflowStep,
  getPodcastWorkflowSteps,
  type PodcastStatus,
} from "@/lib/podchat-data";

export default function IndexPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { podcasts, deletePodcast, regeneratePodcast, hydrated } = useAppData();
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePodcast(id);
  };

  const handleRegenerate = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (regeneratingId === id) {
      return;
    }

    setRegeneratingId(id);

    try {
      await regeneratePodcast(id);
      toast.success(t("podcast.regenerateStarted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("podcast.regenerateFailed"));
    } finally {
      setRegeneratingId((current) => (current === id ? null : current));
    }
  };

  const handleCardClick = (podcastId: string, status: PodcastStatus) => {
    if (status !== "ready") {
      return;
    }

    router.push(`/podcast/${podcastId}/listen`);
  };

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between mb-10 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-[1.1]">
            {t("home.title")}
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">{t("app.tagline")}</p>
        </div>
        <Link
          href="/podcast/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          {t("home.newPodcast")}
        </Link>
      </div>

      {!hydrated ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-2xl bg-card border border-border p-6 animate-pulse">
              <div className="h-5 w-48 bg-secondary rounded mb-3" />
              <div className="h-4 w-72 bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : podcasts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 px-8 py-14 text-center">
          <p className="text-lg font-semibold text-foreground">{t("home.empty")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("home.emptyDesc")}</p>
          <Link
            href="/podcast/new"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity mt-6"
          >
            <Plus className="h-4 w-4" />
            {t("home.newPodcast")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {podcasts.map((podcast, index) => (
            (() => {
              const workflowStep = getPodcastWorkflowStep(podcast);
              const workflowSteps = getPodcastWorkflowSteps(podcast);
              const workflowIndex = getPodcastWorkflowIndex(podcast);
              const isClickable = podcast.status === "ready";
              const canRegenerate = canRegeneratePodcast(podcast);
              const isRegenerating = regeneratingId === podcast.id;

              return (
                <div
                  key={podcast.id}
                  onClick={isClickable ? () => handleCardClick(podcast.id, podcast.status) : undefined}
                  className={`group relative rounded-2xl bg-card border border-border transition-all duration-300 animate-fade-in ${
                    isClickable ? "hover:border-foreground/10 cursor-pointer" : ""
                  }`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${podcast.color} ${
                      isClickable ? "opacity-0 group-hover:opacity-100" : "opacity-0"
                    } transition-opacity duration-500 rounded-2xl overflow-hidden`}
                  />

                  <div className="relative p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <Radio className="h-4 w-4 text-accent flex-shrink-0" />
                          <h3 className="font-semibold text-foreground text-lg truncate">{podcast.title}</h3>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 ${
                              podcast.status === "ready"
                                ? "bg-success/10 text-success"
                                : "bg-accent/10 text-accent"
                            }`}
                          >
                            {podcast.status === "ready"
                              ? t("home.status.ready")
                              : t("home.status.configuring")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-[26px] flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {podcast.duration}
                          </span>
                          <span>
                            {new Date(podcast.createdAt).toLocaleDateString(
                              lang === "zh" ? "zh-CN" : "en-US",
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                          {podcast.aiHost && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {podcast.aiHost}
                            </span>
                          )}
                        </div>
                        {workflowStep && (
                          <div className="ml-[26px] mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{t("home.currentStep")}</span>
                              <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">
                                {t(`home.configStep.${workflowStep}` as never)}
                              </span>
                              {workflowIndex >= 0 && workflowSteps.length > 0 && (
                                <span>
                                  {workflowIndex + 1}/{workflowSteps.length}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-accent transition-all duration-500"
                                  style={{ width: `${podcast.processingProgressPercent}%` }}
                                />
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {podcast.processingProgressPercent}%
                              </div>
                              {podcast.processingError && (
                                <p className="text-[11px] text-destructive">{podcast.processingError}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {podcast.status === "ready" && <SummaryButton podcastId={podcast.id} />}
                        {canRegenerate && (
                          <button
                            onClick={(event) => void handleRegenerate(podcast.id, event)}
                            disabled={isRegenerating}
                            aria-label={t("common.regenerate")}
                            title={t("common.regenerate")}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
                          >
                            {isRegenerating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={(event) => handleDelete(podcast.id, event)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );
}
