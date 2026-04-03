import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Play, Pause, ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const emotions: Record<string, string> = {
  lighthearted: 'bg-emerald-500/10 text-emerald-500',
  serious: 'bg-destructive/10 text-destructive',
  excited: 'bg-accent/10 text-accent',
  reflective: 'bg-info/10 text-info',
  humorous: 'bg-primary/10 text-primary',
};

// Segments per duration — AI auto-assigns emotion
const segmentsByDuration: Record<number, { id: string; label: string; emotion: string; text: string }[]> = {
  1: [
    { id: '1', label: 'Summary', emotion: 'excited', text: "AI creativity is really just sophisticated remixing — and the brain can't tell the difference between AI and human art. The real question is emotional resonance." },
  ],
  3: [
    { id: '1', label: 'Opening', emotion: 'lighthearted', text: "Today's topic: can AI truly be creative? The hosts argue it's blurrier than we think." },
    { id: '2', label: 'Key Insight', emotion: 'excited', text: "AI-generated art triggers the same neurological responses as human art — the brain doesn't distinguish by origin." },
    { id: '3', label: 'Takeaway', emotion: 'reflective', text: "AI won't replace human creativity, but the line between tool and collaborator gets blurrier daily." },
  ],
  5: [
    { id: '1', label: 'Opening', emotion: 'lighthearted', text: "Hey everyone! Today we dove deep into whether AI can truly be creative, or if it's just a sophisticated remix machine." },
    { id: '2', label: 'Key Point 1', emotion: 'serious', text: "The core argument: creativity isn't about generating something from nothing. Even human creativity is built on existing influences. The real question is emotional resonance." },
    { id: '3', label: 'Key Point 2', emotion: 'excited', text: "What blew my mind was Dr. Kim's research — AI-generated art triggers the same neurological responses as human art. The brain doesn't distinguish by origin!" },
    { id: '4', label: 'Key Point 3', emotion: 'reflective', text: "But here's the philosophical bit — if creativity requires intentionality and lived experience, then AI creates through a fundamentally different mechanism." },
    { id: '5', label: 'Closing', emotion: 'humorous', text: "So the verdict? AI won't replace human creativity — but the line between 'tool' and 'collaborator' gets blurrier daily. My robot co-host might steal my job! 😄" },
  ],
  10: [
    { id: '1', label: 'Introduction', emotion: 'lighthearted', text: "Welcome back! Today's episode tackles the big question — is AI creative, or just a very good mimic?" },
    { id: '2', label: 'Background', emotion: 'serious', text: "We start with the history of creativity research. Psychologists have long debated whether creativity is innate or learned, and now AI enters the picture." },
    { id: '3', label: 'Research', emotion: 'excited', text: "Dr. Kim shares her lab's fascinating finding: fMRI scans show identical brain activation patterns when viewing AI vs human art." },
    { id: '4', label: 'Debate', emotion: 'serious', text: "Alex pushes back — if creativity requires suffering, joy, and lived experience, can a machine without consciousness truly create?" },
    { id: '5', label: 'Philosophy', emotion: 'reflective', text: "The discussion turns philosophical. If we can't distinguish the output, does the process matter? Is consciousness necessary for creativity?" },
    { id: '6', label: 'Industry Impact', emotion: 'excited', text: "Real-world examples: AI is already composing film scores, writing novels, and designing architecture. Where does this leave human creators?" },
    { id: '7', label: 'Ethics', emotion: 'serious', text: "The ethical dimension: attribution, copyright, and the value we place on human effort vs machine efficiency." },
    { id: '8', label: 'Future', emotion: 'reflective', text: "Both hosts agree: the future isn't AI vs humans, it's AI + humans. The best creative work will be collaborative." },
    { id: '9', label: 'Closing', emotion: 'humorous', text: "Until next time — and if this episode was actually written by AI, would you even know? 😄" },
  ],
};

export default function SummaryPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [dur, setDur] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [showDurMenu, setShowDurMenu] = useState(false);

  // Auto-start from URL param
  useEffect(() => {
    const d = Number(searchParams.get('dur'));
    if (d && [1, 3, 5, 10].includes(d) && !dur) {
      handleSelectDuration(d);
    }
  }, []);

  const segments = dur ? segmentsByDuration[dur] || [] : [];

  const handleSelectDuration = (d: number) => {
    setDur(d);
    setShowDurMenu(false);
    setGenerating(true);
    setActive(null);
    setProgress(0);
    // Simulate generation
    setTimeout(() => {
      setGenerating(false);
      setActive(segmentsByDuration[d]?.[0]?.id || null);
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('summary.title')}</h1>

        {/* Duration split button */}
        <div className="relative">
          <button
            onClick={() => setShowDurMenu(!showDurMenu)}
            className="h-8 px-4 rounded-full bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm inline-flex items-center gap-1.5"
          >
            {dur ? t('summary.min', { n: dur.toString() }) : t('summary.selectDuration')}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showDurMenu && (
            <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-2xl p-1.5 shadow-lg min-w-[100px] z-10 animate-scale-in">
              {[1, 3, 5, 10].map(d => (
                <button key={d} onClick={() => handleSelectDuration(d)}
                  className={`block w-full px-3 py-1.5 text-xs text-center font-medium rounded-full transition-colors ${
                    dur === d ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-secondary'
                  }`}>{t('summary.min', { n: d.toString() })}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {generating ? (
        <div className="flex flex-col items-center py-20 animate-fade-in">
          <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 animate-pulse">
            <Play className="h-7 w-7 text-accent" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('summary.generating')}</p>
          <div className="w-32 h-1 bg-secondary rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: '70%' }} />
          </div>
        </div>
      ) : segments.length > 0 ? (
        <div className="space-y-4 animate-fade-in">
          {/* Segments */}
          <div className="space-y-2">
            {segments.map(seg => (
              <button key={seg.id} onClick={() => setActive(seg.id)}
                className={`w-full text-left p-4 rounded-xl transition-all ${
                  active === seg.id ? 'bg-card border border-accent/20' : 'bg-card border border-border hover:border-foreground/10'
                }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-foreground">{seg.label}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${emotions[seg.emotion]}`}>
                    {t(`summary.emotions.${seg.emotion}` as any)}
                  </span>
                </div>
                <p className="text-[13px] text-foreground/80 leading-relaxed">{seg.text}</p>
              </button>
            ))}
          </div>

          {/* Player */}
          <div className="rounded-2xl bg-card border border-border p-4">
            <div className="w-full h-1 bg-secondary rounded-full cursor-pointer mb-3"
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - r.left) / r.width) * 100); }}>
              <div className="h-full bg-accent rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">0:00</span>
              <button onClick={() => setPlaying(!playing)}
                className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <span className="font-mono text-[10px] text-muted-foreground">{dur}:00</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground">{t('summary.selectDuration')}</p>
        </div>
      )}
    </div>
  );
}
