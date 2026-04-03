import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const durations = [1, 3, 5, 10];

interface SummaryButtonProps {
  podcastId: string;
  className?: string;
}

export default function SummaryButton({ podcastId, className = '' }: SummaryButtonProps) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (dur: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    nav(`/podcast/${podcastId}/summary?dur=${dur}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(!open); }}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm ${className}`}
      >
        <Zap className="h-3 w-3" />
        {t('home.summary')}
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl py-1 shadow-lg z-20 animate-scale-in min-w-[90px]">
          <p className="px-3 py-1 text-[10px] text-muted-foreground">{t('summary.selectDuration')}</p>
          {durations.map(d => (
            <button key={d} onClick={e => pick(d, e)}
              className="block w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-secondary transition-colors">
              {t('summary.min', { n: d })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
