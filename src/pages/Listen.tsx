import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Zap, Play, Pause, SkipBack, SkipForward, ChevronDown, Settings } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const chapters = [
  { id: '1', title: 'Opening', time: '0:00' },
  { id: '2', title: 'AI & Creativity', time: '5:23' },
  { id: '3', title: 'Ethics Debate', time: '18:45' },
  { id: '4', title: 'Predictions', time: '32:10' },
  { id: '5', title: 'Q&A', time: '41:00' },
];

const transcript = [
  { speaker: 'Alex Chen', color: 'text-accent', time: '00:15', text: 'Welcome everyone to today\'s episode! We have a really exciting topic — the intersection of AI and human creativity.' },
  { speaker: 'Dr. Sarah Kim', color: 'text-info', time: '00:32', text: 'Thanks for having me, Alex! I\'ve been thinking about this a lot lately, especially with the recent advances in generative AI.' },
  { speaker: 'Alex Chen', color: 'text-accent', time: '01:05', text: 'Let\'s dive right in. Can AI truly be creative, or is it just remixing what already exists?' },
  { speaker: 'Dr. Sarah Kim', color: 'text-info', time: '01:28', text: 'That\'s the fundamental question. I\'d argue that what we call "creativity" in humans is also a form of remixing — we\'re all influenced by what we\'ve experienced.' },
  { speaker: 'Alex Chen', color: 'text-accent', time: '02:15', text: 'So the line between human and machine creativity is blurrier than we think?' },
  { speaker: 'Dr. Sarah Kim', color: 'text-info', time: '02:40', text: 'Exactly. The real question isn\'t whether AI can be creative — it\'s whether the output resonates with humans emotionally.' },
];

export default function ListenPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [activeCh, setActiveCh] = useState('2');

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6">
      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground truncate">The Future of AI & Creativity</h1>
        <div className="flex items-center gap-1">
          <Link to={`/podcast/${id}/chat`} className="h-7 px-2.5 rounded-md bg-secondary text-xs font-medium text-secondary-foreground hover:bg-surface-hover transition-colors inline-flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> {t('home.chat')}
          </Link>
          <Link to={`/podcast/${id}/summary`} className="h-7 px-2.5 rounded-md bg-secondary text-xs font-medium text-secondary-foreground hover:bg-surface-hover transition-colors inline-flex items-center gap-1">
            <Zap className="h-3 w-3" /> {t('home.summary')}
          </Link>
          <Link to={`/podcast/${id}/settings`} className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        {/* Main content */}
        <div className="space-y-4">
          {/* Player */}
          <div className="rounded-2xl bg-card border border-border p-4">
            <div className="mb-4">
              <div className="w-full h-1 bg-secondary rounded-full cursor-pointer group relative"
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - r.left) / r.width) * 100); }}>
                <div className="h-full bg-accent rounded-full relative" style={{ width: `${progress}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-accent scale-0 group-hover:scale-100 transition-transform" />
                </div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">15:52</span>
                <span className="font-mono text-[10px] text-muted-foreground">45:23</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-5">
              <button className="text-muted-foreground hover:text-foreground transition-colors"><SkipBack className="h-4 w-4" /></button>
              <button onClick={() => setPlaying(!playing)}
                className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors"><SkipForward className="h-4 w-4" /></button>
              <div className="relative">
                <button onClick={() => setShowSpeed(!showSpeed)}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">{speed}x <ChevronDown className="h-3 w-3" /></button>
                {showSpeed && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-1 shadow-lg">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                      <button key={s} onClick={() => { setSpeed(s); setShowSpeed(false); }}
                        className={`block w-full px-3 py-1 text-xs rounded-md ${speed === s ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-secondary'}`}>{s}x</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat CTA */}
          <Link to={`/podcast/${id}/chat`}
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-accent/10 text-accent text-sm font-medium hover:bg-accent/15 transition-colors">
            <MessageCircle className="h-4 w-4" /> {t('listen.chatNow')}
          </Link>

          {/* Transcript */}
          <div className="rounded-2xl bg-card border border-border p-4 max-h-[380px] overflow-y-auto">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('listen.transcript')}</p>
            <div className="space-y-3">
              {transcript.map((l, i) => (
                <div key={i} className="cursor-pointer hover:bg-secondary/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[11px] font-semibold ${l.color}`}>{l.speaker}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{l.time}</span>
                  </div>
                  <p className="text-[13px] text-foreground leading-relaxed">{l.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: chapters */}
        <div className="hidden lg:block">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('listen.chapters')}</p>
          <div className="space-y-1">
            {chapters.map(ch => (
              <button key={ch.id} onClick={() => setActiveCh(ch.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  activeCh === ch.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground hover:bg-secondary'
                }`}>
                <span className="truncate">{ch.title}</span>
                <span className="font-mono text-[10px] text-muted-foreground ml-2 shrink-0">{ch.time}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
