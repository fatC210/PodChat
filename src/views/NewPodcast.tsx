"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, User, Users, FileAudio, Brain, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { useBackNavigation } from "@/lib/navigation";
import { personaPresets, type PersonaPreset, type PodcastType } from "@/lib/podchat-data";
import { getMaxUploadSizeMb, isFileTooLarge } from "@/lib/upload-limits";

const wizardSteps = [
  { key: "upload", icon: Upload, titleKey: "wizard.step1", descKey: "wizard.step1Desc", pillKey: "wizard.pill.upload" },
  { key: "type", icon: Users, titleKey: "wizard.step2", descKey: "wizard.step2Desc", pillKey: "wizard.pill.type" },
  { key: "persona", icon: Brain, titleKey: "wizard.step9", descKey: "wizard.step9Desc", pillKey: "wizard.pill.persona" },
  { key: "review", icon: Check, titleKey: "wizard.reviewTitle", descKey: "wizard.reviewDesc", pillKey: "wizard.reviewPill" },
] as const;

export default function NewPodcastPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useBackNavigation("/");
  const draftId = searchParams.get("draft");
  const { podcasts, hydrated, savePodcastFromWizard } = useAppData();
  const draftPodcast = podcasts.find((podcast) => podcast.id === draftId) ?? null;

  const [step, setStep] = useState(0);
  const [type, setType] = useState<PodcastType>("solo");
  const [refCount, setRefCount] = useState(2);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; sizeMb: number } | null>(null);
  const [fileError, setFileError] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customPersonality, setCustomPersonality] = useState("");
  const [saving, setSaving] = useState(false);
  const maxUploadSizeMb = getMaxUploadSizeMb();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const presetId = draftPodcast?.persona.presetId ?? "";
    setStep(0);
    setType(draftPodcast?.type ?? "solo");
    setRefCount(draftPodcast?.referenceCount ?? 2);
    setTitle(draftPodcast?.title ?? "");
    setSelectedFile(null);
    setFileMeta(
      draftPodcast
        ? { name: draftPodcast.sourceFileName, sizeMb: draftPodcast.sourceFileSizeMb }
        : null,
    );
    setFileError("");
    setSelectedPreset(presetId);
    setCustomPersonality(draftPodcast?.persona.customPersonality ?? "");
  }, [draftPodcast, hydrated]);

  const handleFile = (file: File) => {
    if (isFileTooLarge(file)) {
      const message =
        lang === "zh"
          ? `文件过大，上传失败。当前部署环境最多支持 ${maxUploadSizeMb} MB。`
          : `Upload failed. This deployment accepts files up to ${maxUploadSizeMb} MB.`;
      setFileError(message);
      toast.error(message);
      return;
    }

    const nextTitle = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    setFileError("");
    setSelectedFile(file);
    setFileMeta({ name: file.name, sizeMb: Number((file.size / 1024 / 1024).toFixed(1)) });
    setTitle((current) => current || nextTitle);
  };

  const selectedPersona = useMemo(
    () => personaPresets.find((entry) => entry.id === selectedPreset) ?? null,
    [selectedPreset],
  ) as PersonaPreset | null;
  const effectiveTitle = title.trim() || fileMeta?.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "";
  const canSubmit = Boolean(fileMeta && effectiveTitle && (selectedFile || draftPodcast));

  const canAdvance =
    step === 0
      ? Boolean(fileMeta && effectiveTitle)
      : step === 1
      ? type === "solo" || refCount >= 2
      : true;

  const handleNext = () => {
    if (!canAdvance || step >= wizardSteps.length - 1) {
      return;
    }

    setStep((current) => current + 1);
  };

  const handlePrev = () => {
    if (step === 0) {
      return;
    }

    setStep((current) => current - 1);
  };

  const handleConfirm = async () => {
    if (!fileMeta || !effectiveTitle || saving || (!selectedFile && !draftPodcast)) {
      return;
    }

    setSaving(true);

    try {
          await savePodcastFromWizard(
        {
          draftId: draftPodcast?.id,
          title: effectiveTitle,
          type,
          referenceCount: refCount,
          sourceFileName: fileMeta.name,
          sourceFileSizeMb: fileMeta.sizeMb,
          personaPresetId: selectedPreset,
          personaLocale: lang,
          customPersonality,
          customCatchphrases: "",
          customAnswerStyle: "",
        },
        selectedFile,
      );

      router.push("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Podcast creation failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>;
  }

  const currentStep = wizardSteps[step];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("nav.back")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">{t("wizard.title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {draftPodcast ? t("wizard.editDraft") : t("wizard.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8 gap-2">
        {wizardSteps.map((wizardStep, index) => (
          <div key={wizardStep.key} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => {
                if (index <= step) {
                  setStep(index);
                }
              }}
              disabled={index > step}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  index === step
                    ? "bg-accent border-accent text-accent-foreground shadow-md shadow-accent/20"
                    : index < step
                    ? "bg-accent/15 border-accent text-accent cursor-pointer"
                    : "bg-secondary border-border text-muted-foreground"
                }`}
              >
                {index < step ? <Check className="h-4 w-4" /> : <wizardStep.icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-[11px] font-medium transition-colors ${
                  index <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t(wizardStep.pillKey as never)}
              </span>
            </button>
            {index < wizardSteps.length - 1 && (
              <div className="flex-1 flex items-center justify-center px-2 -mt-5">
                <div className="flex items-center gap-1 w-full justify-center">
                  {Array.from({ length: 5 }).map((_, dotIndex) => (
                    <div
                      key={dotIndex}
                      className={`h-1 w-1 rounded-full transition-colors ${
                        index < step ? "bg-accent" : "bg-border"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-foreground">{t(currentStep.titleKey as never)}</p>
        <p className="text-xs text-muted-foreground">{t(currentStep.descKey as never)}</p>
      </div>

      <div className="animate-fade-in">
        {step === 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <label
              className={`flex flex-col items-center justify-center h-56 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                fileError
                  ? "border-destructive/70 bg-destructive/5"
                  : fileMeta
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-muted-foreground"
              }`}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onDragOver={(event) => event.preventDefault()}
            >
              {fileMeta ? (
                <div className="text-center">
                  <FileAudio className="h-8 w-8 text-accent mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">{fileMeta.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fileMeta.sizeMb.toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("wizard.upload.drag")}</p>
                  <p className="text-xs text-accent font-medium mt-2">{t("wizard.upload.browse")}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t("wizard.upload.formats")}</p>
                  <p className="text-[11px] text-accent mt-1">
                    {lang === "zh"
                      ? `最大上传大小：${maxUploadSizeMb} MB`
                      : `Maximum upload size: ${maxUploadSizeMb} MB`}
                  </p>
                </div>
              )}
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,.mov,.avi,.mkv,.webm"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFile(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {fileError ? <p className="text-xs text-destructive">{fileError}</p> : null}

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wizard.podcastTitle")}</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("wizard.podcastTitlePlaceholder")}
                className="w-full h-10 px-3 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

          </div>
        )}

        {step === 1 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[{ key: "solo" as const, icon: User }, { key: "multi" as const, icon: Users }].map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setType(option.key);
                    if (option.key === "solo") {
                      setRefCount(1);
                    } else if (refCount < 2) {
                      setRefCount(2);
                    }
                  }}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${
                    type === option.key ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <option.icon
                    className={`h-5 w-5 mb-2 ${type === option.key ? "text-accent" : "text-muted-foreground"}`}
                  />
                  <p className="font-medium text-sm text-foreground">{t(`wizard.type.${option.key}` as never)}</p>
                </button>
              ))}
            </div>

            {type === "multi" && (
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-muted-foreground">{t("wizard.type.refCount")}</label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={refCount}
                  onChange={(event) => setRefCount(Number(event.target.value))}
                  className="wizard-number-input w-24 h-10 px-3 rounded-xl border border-border bg-secondary text-sm font-semibold text-foreground text-center focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">{t("wizard.persona.selectPreset")}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedPreset("")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    !selectedPreset
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">{t("wizard.persona.noPreset")}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {t("wizard.persona.noPresetDesc")}
                  </p>
                </button>
                {personaPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedPreset === preset.id
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{t(preset.labelKey as never)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{preset.personality[lang]}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedPersona ? (
              <div className="space-y-2 rounded-xl bg-secondary/50 p-4">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">{t("podSettings.personality")}</span>
                  <p className="text-sm text-foreground">{selectedPersona.personality[lang]}</p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">{t("podSettings.catchphrases")}</span>
                  <p className="text-sm text-foreground">{selectedPersona.catchphrases[lang]}</p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">{t("podSettings.answerStyle")}</span>
                  <p className="text-sm text-foreground">{selectedPersona.answerStyle[lang]}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="text-sm text-foreground">{t("wizard.persona.noPresetDesc")}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{t("wizard.persona.customLabel")}</label>
                <textarea
                  value={customPersonality}
                  onChange={(event) => setCustomPersonality(event.target.value)}
                  placeholder={t("wizard.persona.customPlaceholder")}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-secondary/50 p-4 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">{t("wizard.reviewFileLabel")}</p>
                  <p className="text-sm font-medium text-foreground mt-1 break-all">{fileMeta?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fileMeta ? `${fileMeta.sizeMb.toFixed(1)} MB` : "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">{t("wizard.podcastTitle")}</p>
                  <p className="text-sm font-medium text-foreground mt-1 break-all">{effectiveTitle || "-"}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">{t("wizard.reviewFormatLabel")}</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {t(`wizard.type.${type}` as never)}
                  </p>
                  {type === "multi" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("wizard.reviewSpeakers", { count: refCount })}
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">{t("wizard.reviewPersonaLabel")}</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {selectedPersona ? t(selectedPersona.labelKey as never) : t("wizard.persona.noPreset")}
                  </p>
                </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-0 transition-all"
        >
          <ChevronLeft className="h-4 w-4" /> {t("common.previous")}
        </button>
        {step < wizardSteps.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canAdvance}
            className="inline-flex items-center gap-1 h-9 px-5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            {t("common.next")} <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || saving}
            className="inline-flex items-center gap-1 h-9 px-5 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            {t("common.confirm")} <Check className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
