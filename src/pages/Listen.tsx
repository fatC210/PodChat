import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Zap, Play, Pause, SkipBack, SkipForward, ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const mockChapters = [
  { id: '1', title: 'Opening & Introduction', start: '00:00', end: '05:23' },
  { id: '2', title: 'AI & Human Creativity', start: '05:23', end: '18:45' },
  { id: '3', title: 'The Ethics Debate', start: '18:45', end: '32:10' },
  { id: '4', title: 'Future Predictions', start: '32:10', end: '41:00' },
  { id: '5', title: 'Listener Q&A', start: '41:00', end: '45:23' },
];

const mockScript = [
  { speaker: 'Alex Chen', speakerColor: 'text-primary', time: '00:15', text: 'Welcome everyone to today\'s episode! We have a really exciting topic lined up — the intersection of AI and human creativity.' },
  { speaker: 'Dr. Sarah Kim', speakerColor: 'text-info', time: '00:32', text: 'Thanks for having me, Alex! I\'ve been thinking about this a lot lately, especially with the recent advances in generative AI.' },
  { speaker: 'Alex Chen', speakerColor: 'text-primary', time: '01:05', text: 'Let\'s dive right in. The big question everyone\'s asking is — can AI truly be creative, or is it just remixing what already exists?' },
  { speaker: 'Dr. Sarah Kim', speakerColor: 'text-info', time: '01:28', text: 'That\'s the fundamental question. I\'d argue that what we call "creativity" in humans is also a form of remixing — we\'re influenced by everything we\'ve experienced.' },
  { speaker: 'Alex Chen', speakerColor: 'text-primary', time: '02:15', text: 'That\'s a fascinating perspective. So you\'re saying the line between human and machine creativity is blurrier than we think?' },
  { speaker: 'Dr. Sarah Kim', speakerColor: 'text-info', time: '02:40', text: 'Exactly. The real question isn\'t whether AI can be creative — it\'s whether the output resonates with humans emotionally.' },
];

export default function ListenPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [activeChapter, setActiveChapter] = useState('2');

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="container py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-lg font-semibold text-foreground truncate">
            The Future of AI & Creativity
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            to={`/podcast/${id}/chat`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-surface text-xs font-medium text-foreground hover:bg-surface-hover transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t('home.chat')}
          </Link>
          <Link
            to={`/podcast/${id}/summary`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-surface text-xs font-medium text-foreground hover:bg-surface-hover transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            {t('home.summary')}
          </Link>
        </div>
      </div>

      {/* Chapters */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {t('listen.chapters')}
        </h3>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {mockChapters.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChapter(ch.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeChapter === ch.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              {ch.title}
            </button>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 max-h-[400px] overflow-y-auto">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
          {t('listen.transcript')}
        </h3>
        <div className="space-y-4">
          {mockScript.map((line, i) => (
            <div key={i} className="group cursor-pointer hover:bg-surface/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-semibold ${line.speakerColor}`}>
                  {line.speaker}
                </span>
                <span className="text-[10px] text-muted-foreground">{line.time}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{line.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Player */}
      <div className="bg-card border border-border rounded-xl p-4">
        {/* Progress bar */}
        <div className="mb-3">
          <div
            className="w-full h-1.5 bg-surface rounded-full cursor-pointer group"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              setProgress(((e.clientX - rect.left) / rect.width) * 100);
            }}
          >
            <div
              className="h-full bg-primary rounded-full relative transition-all group-hover:h-2 group-hover:-mt-[1px]"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">15:52</span>
            <span className="text-[10px] text-muted-foreground">45:23</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
            <SkipForward className="h-4 w-4" />
          </button>
          <div className="relative ml-2">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-0.5 h-7 px-2 rounded-md bg-surface text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {speed}x
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full mb-1 right-0 bg-card border border-border rounded-lg shadow-lg p-1 min-w-[60px]">
                {speeds.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                    className={`w-full px-2 py-1 rounded text-xs text-left transition-colors ${
                      speed === s ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-surface'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat CTA */}
        <div className="mt-4 pt-3 border-t border-border">
          <Link
            to={`/podcast/${id}/chat`}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {t('listen.chatNow')}
          </Link>
        </div>
      </div>
    </div>
  );
}
