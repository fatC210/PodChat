"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { testIntegrationConnection } from "@/lib/api";
import type { IntegrationProvider } from "@/lib/chat";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAppData } from "@/lib/app-data";
import { useBackNavigation } from "@/lib/navigation";
import type { IntegrationSettings } from "@/lib/podchat-data";

function StatusDot({ status }: { status?: string }) {
  if (status === "testing") return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return null;
}

function KeyInput({
  label,
  placeholder,
  value,
  onChange,
  show,
  onToggle,
  onTest,
  testLabel,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean;
  onToggle: () => void;
  onTest: () => void;
  testLabel: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full h-9 px-3 pr-8 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <button
          type="button"
          onClick={onTest}
          className="h-9 px-3 rounded-lg bg-secondary text-xs font-medium text-secondary-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          {testLabel}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { integrationSettings, saveIntegrationSettings, hydrated } = useAppData();
  const goBack = useBackNavigation("/");
  const [draft, setDraft] = useState<IntegrationSettings>(integrationSettings);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(integrationSettings);
  }, [integrationSettings]);

  const toggle = (key: string) => setShow((current) => ({ ...current, [key]: !current[key] }));

  const formatIntegrationMessage = (result: Awaited<ReturnType<typeof testIntegrationConnection>>) => {
    switch (result.code) {
      case "ok":
        return t(`settings.test.ok.${result.provider}`);
      case "ok_firecrawl":
        return typeof result.remainingCredits === "number"
          ? t("settings.test.ok.firecrawlCredits", { count: result.remainingCredits })
          : t("settings.test.ok.firecrawl");
      case "ok_llm":
        return t("settings.test.ok.llm", { model: result.model ?? draft.llmModel ?? "unknown" });
      case "missing_api_key":
        return t(`settings.test.missing.${result.provider}`);
      case "missing_llm_config":
        return t("settings.test.missing.llm");
      case "unsupported_provider":
        return t("settings.test.error.unsupported");
      case "upstream_error":
        return result.detail
          ? `${t("settings.test.error.upstream", { provider: t(`settings.provider.${result.provider}`) })} ${result.detail}`
          : t("settings.test.error.upstream", { provider: t(`settings.provider.${result.provider}`) });
      default:
        return t("settings.test.error.generic");
    }
  };

  const test = async (provider: IntegrationProvider, statusKey: string) => {
    setStatus((current) => ({ ...current, [statusKey]: "testing" }));

    try {
      const result = await testIntegrationConnection({
        provider,
        settings: draft,
      });

      setStatus((current) => ({ ...current, [statusKey]: result.ok ? "ok" : "fail" }));
      const message = formatIntegrationMessage(result);

      if (result.ok) {
        toast.success(message);
        return;
      }

      toast.error(message);
    } catch (error) {
      setStatus((current) => ({ ...current, [statusKey]: "fail" }));
      toast.error(t("settings.test.error.generic"));
    }
  };

  const save = async () => {
    if (saving) {
      return;
    }

    setSaving(true);

    try {
      await saveIntegrationSettings(draft);
      toast.success(t("settings.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.test.error.generic"));
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={goBack}
          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("nav.back")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">{t("settings.subtitle")}</p>

      <div className="space-y-6">
        <div className="flex items-center justify-between py-3 border-b border-border">
          <span className="text-sm text-foreground">{t("settings.theme")}</span>
          <div className="flex bg-secondary rounded-lg p-0.5">
            {(["dark", "light"] as const).map((nextTheme) => (
              <button
                key={nextTheme}
                onClick={() => setTheme(nextTheme)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  theme === nextTheme ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {nextTheme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                {t(`settings.${nextTheme}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <span className="text-sm text-foreground">{t("settings.language")}</span>
          <div className="flex bg-secondary rounded-lg p-0.5">
            {(["en", "zh"] as const).map((nextLang) => (
              <button
                key={nextLang}
                onClick={() => setLang(nextLang)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  lang === nextLang ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {nextLang === "en" ? "English" : "中文"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("settings.elevenlabs")}</h3>
              <p className="text-xs text-muted-foreground">{t("settings.elevenlabsDesc")}</p>
            </div>
            <StatusDot status={status.elevenlabs} />
          </div>
          <KeyInput
            label={t("settings.apiKey")}
            placeholder="sk_..."
            value={draft.elevenlabs}
            onChange={(event) => setDraft((current) => ({ ...current, elevenlabs: event.target.value }))}
            show={!!show.elevenlabs}
            onToggle={() => toggle("elevenlabs")}
            onTest={() => test("elevenlabs", "elevenlabs")}
            testLabel={t("common.testConnection")}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("settings.firecrawl")}</h3>
              <p className="text-xs text-muted-foreground">{t("settings.firecrawlDesc")}</p>
            </div>
            <StatusDot status={status.firecrawl} />
          </div>
          <KeyInput
            label={t("settings.apiKey")}
            placeholder="fc-..."
            value={draft.firecrawl}
            onChange={(event) => setDraft((current) => ({ ...current, firecrawl: event.target.value }))}
            show={!!show.firecrawl}
            onToggle={() => toggle("firecrawl")}
            onTest={() => test("firecrawl", "firecrawl")}
            testLabel={t("common.testConnection")}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("settings.llm")}</h3>
              <p className="text-xs text-muted-foreground">{t("settings.llmDesc")}</p>
            </div>
            <StatusDot status={status.llm} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{t("settings.baseUrl")}</label>
            <input
              value={draft.llmUrl}
              onChange={(event) => setDraft((current) => ({ ...current, llmUrl: event.target.value }))}
              placeholder="https://api.openai.com/v1"
              className="w-full h-9 px-3 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <KeyInput
            label={t("settings.apiKey")}
            placeholder="sk-..."
            value={draft.llmKey}
            onChange={(event) => setDraft((current) => ({ ...current, llmKey: event.target.value }))}
            show={!!show.llmKey}
            onToggle={() => toggle("llmKey")}
            onTest={() => test("llm", "llm")}
            testLabel={t("common.testConnection")}
          />
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{t("settings.modelName")}</label>
            <input
              value={draft.llmModel}
              onChange={(event) => setDraft((current) => ({ ...current, llmModel: event.target.value }))}
              placeholder="gpt-4o-mini"
              className="w-full h-9 px-3 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
