import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const emotionColors: Record<string, { bg: string; text: string; dot: string }> = {
  lighthearted: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  serious: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  excited: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  reflective: { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  humorous: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
};

const mockSummarySegments = [
  { id: '1', label: 'Opening', emotion: 'lighthearted', text: "Hey everyone! In today's episode, we dove deep into one of the most debated topics in tech — whether AI can truly be creative, or if it's just a sophisticated remix machine." },
  { id: '2', label: 'Key Point 1', emotion: 'serious', text: "The core argument: creativity isn't about generating something from nothing. Even human creativity is built on existing influences. The real question is whether the output creates genuine emotional resonance." },
  { id: '3', label: 'Key Point 2', emotion: 'excited', text: "What really got me excited was Dr. Kim's research showing that AI-generated art can trigger the same neurological responses as human art — the brain doesn't distinguish based on origin!" },
  { id: '4', label: 'Key Point 3', emotion: 'reflective', text: "But here's where it gets philosophical — if creativity requires intentionality and lived experience, then AI is creating through a fundamentally different mechanism. Pattern recognition vs. emotional expression." },
  { id: '5', label: 'Closing', emotion: 'humorous', text: "So the verdict? AI won't replace human creativity — but the line between 'tool' and 'collaborator' is getting blurrier every day. And honestly? That's pretty exciting, even if it means my robot co-host might steal my job! 😄" },
];

export default function SummaryPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [isGenerated, setIsGenerated] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(42);
  const [activeSegment, setActiveSegment] = useState('2');

  const durations = [1, 3, 5, 10];

  return (
    <div className="container py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/podcast/${id}/listen`} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-lg font-semibold text-foreground">{t('summary.title')}</h1>
      </div>

      {/* Duration selector */}
      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t('summary.selectDuration')}</p>
        <div className="flex gap-2">
          {durations.map(d => (
            <button
              key={d}
              onClick={() => { setSelectedDuration(d); setIsGenerated(d === 5); }}
              className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
                selectedDuration === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              {t('summary.min', { n: d.toString() })}
            </button>
          ))}
        </div>
      </div>

      {isGenerated ? (
        <>
          {/* Summary segments */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4 max-h-[400px] overflow-y-auto">
            {mockSummarySegments.map(seg => {
              const colors = emotionColors[seg.emotion];
              const isActive = activeSegment === seg.id;
              return (
                <div
                  key={seg.id}
                  onClick={() => setActiveSegment(seg.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    isActive ? 'bg-surface ring-1 ring-primary/30' : 'hover:bg-surface/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-foreground">[{seg.label}]</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                      {t(`summary.emotions.${seg.emotion}` as any)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{seg.text}</p>
                  <button className="flex items-center gap-1 text-[10px] text-primary hover:underline mt-2">
                    <ExternalLink className="h-2.5 w-2.5" />
                    {t('summary.jumpToOriginal')}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Player */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="mb-3">
              <div
                className="w-full h-1.5 bg-surface rounded-full cursor-pointer group"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setProgress(((e.clientX - rect.left) / rect.width) * 100);
                }}
              >
                <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">2:06</span>
                <span className="text-[10px] text-muted-foreground">5:00</span>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <button
            onClick={() => setIsGenerated(true)}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('summary.generate')}
          </button>
        </div>
      )}
    </div>
  );
}
