"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronUp, Globe, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { useBackNavigation } from "@/lib/navigation";
import { canRegeneratePodcast, type PersonaSettings } from "@/lib/podchat-data";

const personaFields: Array<keyof PersonaSettings> = [
  "personality",
  "catchphrases",
  "answerStyle",
  "languagePref",
];

function hasPersonaChanges(current: PersonaSettings, next: PersonaSettings) {
  return personaFields.some((field) => current[field] !== next[field]);
}

export default function PodcastSettingsPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const goBack = useBackNavigation("/");
  const { podcasts, hydrated, updatePodcast, regeneratePodcast, deletePodcast } = useAppData();
  const podcast = podcasts.find((entry) => entry.id === params.id);
  const [showPages, setShowPages] = useState(false);
  const [persona, setPersona] = useState<PersonaSettings | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (podcast) {
      setPersona(podcast.persona);
    }
  }, [podcast]);

  const autoSave = (nextPersona: PersonaSettings) => {
    if (!podcast) {
      return;
    }

    if (!hasPersonaChanges(podcast.persona, nextPersona)) {
      return;
    }

    updatePodcast(podcast.id, (current) => ({
      ...current,
      persona: nextPersona,
    }));
    toast.success(t("settings.saved"));
  };

  const updatePersonaField = (field: keyof PersonaSettings, value: string) => {
    setPersona((current) => {
      if (!current) {
        return current;
      }

      const next = { ...current, [field]: value };
      return next;
    });
  };

  const handleDelete = () => {
    if (!podcast) {
      return;
    }

    deletePodcast(podcast.id);
    router.push("/");
  };

  const handleRegenerate = async () => {
    if (!podcast || regenerating || !canRegeneratePodcast(podcast)) {
      return;
    }

    setRegenerating(true);

    try {
      await regeneratePodcast(podcast.id);
      toast.success(t("podcast.regenerateStarted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("podcast.regenerateFailed"));
    } finally {
      setRegenerating(false);
    }
  };

  if (!hydrated) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!podcast || !persona) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-lg font-semibold text-foreground">{t("podSettings.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-3 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("nav.back")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">{t("podSettings.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{podcast.title}</p>
        </div>
      </div>

      <div className="space-y-6">
        {podcast.processingError && (
          <section className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <h3 className="text-sm font-semibold text-foreground">{t("podSettings.processingNote")}</h3>
            <p className="text-xs text-muted-foreground mt-1">{podcast.processingError}</p>
          </section>
        )}

        {canRegeneratePodcast(podcast) && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t("podSettings.regenerateTitle")}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t("podSettings.regenerateDesc")}</p>
              </div>
              <button
                onClick={() => void handleRegenerate()}
                disabled={regenerating}
                aria-label={t("common.regenerate")}
                title={t("common.regenerate")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-60"
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </button>
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t("podSettings.persona")}</h3>
          <div className="space-y-3">
            {[
              { key: "personality", label: t("podSettings.personality") },
              { key: "catchphrases", label: t("podSettings.catchphrases") },
              { key: "answerStyle", label: t("podSettings.answerStyle") },
              { key: "languagePref", label: t("podSettings.languagePref") },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                <textarea
                  value={persona[field.key as keyof PersonaSettings] as string}
                  rows={2}
                  onChange={(event) =>
                    updatePersonaField(field.key as keyof PersonaSettings, event.target.value)
                  }
                  onBlur={() => autoSave(persona)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t("podSettings.knowledgeBase")}</h3>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{t("podSettings.scriptChunks")}</span>
                <span className="text-xs text-muted-foreground">({podcast.scriptChunks.length})</span>
              </div>
              <div className="mt-3 space-y-2">
                {podcast.scriptChunks.length > 0 ? (
                  podcast.scriptChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-5 text-foreground"
                    >
                      <span className="mr-2 text-muted-foreground">#{chunk.id}</span>
                      {chunk.text}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                    {t("podSettings.emptyKnowledge")}
                  </div>
                )}
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowPages((current) => !current)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">{t("podSettings.crawledPages")}</span>
                  <span className="text-xs text-muted-foreground">({podcast.crawledPages.length})</span>
                </div>
                {showPages ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {showPages && (
                <div className="mt-1 space-y-1 animate-fade-in">
                  {podcast.crawledPages.length > 0 ? (
                    podcast.crawledPages.map((page) => (
                      <a
                        key={page.id}
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg bg-secondary/50 px-3 py-3 text-xs text-foreground transition-colors hover:bg-secondary"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">#{page.id}</span>
                          <span className="text-accent underline underline-offset-2">{page.title}</span>
                        </div>
                        <div className="mt-1 break-all text-[11px] text-muted-foreground">{page.url}</div>
                        {page.matchedTerms && page.matchedTerms.length > 0 && (
                          <div className="mt-2 text-[11px] text-foreground/80">
                            {page.matchedTerms.join(" · ")}
                          </div>
                        )}
                        {page.excerpt && (
                          <p className="mt-2 max-h-[4.75rem] overflow-hidden text-[11px] leading-5 text-muted-foreground">
                            {page.excerpt}
                          </p>
                        )}
                        {page.reason && (
                          <p className="mt-2 text-[11px] text-muted-foreground/80">{page.reason}</p>
                        )}
                      </a>
                    ))
                  ) : (
                    <div className="px-3 py-2 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
                      {t("podSettings.emptyKnowledge")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("podSettings.dangerZone")}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t("podSettings.deletePodcast")}
              </p>
            </div>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
