"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { summaryDurations } from "@/lib/podchat-data";

interface SummaryButtonProps {
  podcastId: string;
  className?: string;
}

export default function SummaryButton({ podcastId, className = "" }: SummaryButtonProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = (duration: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpen(false);
    router.push(`/podcast/${podcastId}/summary?dur=${duration}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setOpen((current) => !current);
        }}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm ${className}`}
      >
        <Zap className="h-3 w-3" />
        {t("home.summary")}
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-2xl p-1.5 shadow-lg z-20 animate-scale-in min-w-[100px]">
          {summaryDurations.map((duration) => (
            <button
              key={duration}
              onClick={(event) => pick(duration, event)}
              className="block w-full px-3 py-1.5 text-xs text-center font-medium rounded-full transition-colors text-foreground hover:bg-secondary"
            >
              {t("summary.min", { n: duration })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
