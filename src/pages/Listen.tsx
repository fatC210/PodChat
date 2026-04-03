import { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Play, Pause, RotateCcw, RotateCw, Settings, ChevronDown, Languages, Download } from 'lucide-react';
import SummaryButton from '@/components/SummaryButton';
import { useI18n } from '@/lib/i18n';
import FloatingChat from '@/components/FloatingChat';

const chapters = [
  { id: '1', title: 'Opening', time: '0:00' },
  { id: '2', title: 'AI & Creativity', time: '5:23' },
  { id: '3', title: 'Ethics Debate', time: '18:45' },
  { id: '4', title: 'Predictions', time: '32:10' },
  { id: '5', title: 'Q&A', time: '41:00' },
];

const transcript = [
  { speaker: 'Alex Chen', color: 'text-accent', time: '00:15', text: 'Welcome everyone to today\'s episode! We have a really exciting topic — the intersection of AI and human creativity.', translation: '欢迎大家来到今天的节目！我们有一个非常令人兴奋的话题——人工智能与人类创造力的交汇。' },
  { speaker: 'Dr. Sarah Kim', color: 'text-info', time: '00:32', text: 'Thanks for having me, Alex! I\'ve been thinking about this a lot lately, especially with the recent advances in generative AI.', translation: '谢谢你邀请我，Alex！我最近一直在思考这个问题，尤其是随着生成式AI的最新进展。' },
  { speaker: 'Alex Chen', color: 'text-accent', time: '01:05', text: 'Let\'s dive right in. Can AI truly be creative, or is it just remixing what already exists?', translation: '让我们直入主题。AI 真的能有创造力吗，还是它只是在重新组合已有的东西？' },
  { speaker: 'Dr. Sarah Kim', color: 'text-info', time: '01:28', text: 'That\'s the fundamental question. I\'d argue that what we call "creativity" in humans is also a form of remixing — we\'re all influenced by what we\'ve experienced.', translation: '这是最根本的问题。我认为我们所说的人类"创造力"其实也是一种重新组合——我们都受到自身经历的影响。' },
  { speaker: 'Alex Chen', color: 'text-accent', time: '02:15', text: 'So the line between human and machine creativity is blurrier than we think?', translation: '那么人类和机器创造力之间的界限比我们想象的更模糊？' },
  { speaker: 'Dr. Sarah Kim', color: 'text-info', time: '02:40', text: 'Exactly. The real question isn\'t whether AI can be creative — it\'s whether the output resonates with humans emotionally.', translation: '没错。真正的问题不是AI能否有创造力——而是其产出能否在情感上引起人类的共鸣。' },
];

type TranscriptMode = 'original' | 'translated' | 'trans-top' | 'trans-bottom';

const targetLangs = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function ListenPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [activeCh, setActiveCh] = useState('2');
  const [chatOpen, setChatOpen] = useState(false);
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>('original');
  const [showTranscriptMenu, setShowTranscriptMenu] = useState(false);
  const [targetLang, setTargetLang] = useState('zh');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);

  const speakers = [...new Set(transcript.map(l => l.speaker))];
  const progressRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const timeToSeconds = (t: string) => {
    const parts = t.split(':').map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  };

  const totalDuration = 2723; // 45:23 in seconds
  const currentTime = (progress / 100) * totalDuration;
  const activeLineIndex = transcript.reduce((acc, l, i) => {
    return timeToSeconds(l.time) <= currentTime ? i : acc;
  }, 0);

  useEffect(() => {
    if (activeLineRef.current && transcriptContainerRef.current) {
      const container = transcriptContainerRef.current;
      const el = activeLineRef.current;
      const top = el.offsetTop - container.offsetTop - container.clientHeight / 3;
      container.scrollTo({ top, behavior: 'smooth' });
    }
  }, [activeLineIndex]);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const fmtSrt = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)},000`;
  const fmtVtt = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}.000`;

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportTxt = () => {
    const content = transcript.map(l => `[${l.time}] ${l.speaker}: ${l.text}`).join('\n\n');
    downloadFile(content, 'transcript.txt');
    setShowExportMenu(false);
  };

  const exportSrt = () => {
    const content = transcript.map((l, i) => {
      const start = timeToSeconds(l.time);
      const end = i < transcript.length - 1 ? timeToSeconds(transcript[i + 1].time) : start + 10;
      return `${i + 1}\n${fmtSrt(start)} --> ${fmtSrt(end)}\n${l.speaker}: ${l.text}`;
    }).join('\n\n');
    downloadFile(content, 'transcript.srt');
    setShowExportMenu(false);
  };

  const exportVtt = () => {
    const lines = transcript.map((l, i) => {
      const start = timeToSeconds(l.time);
      const end = i < transcript.length - 1 ? timeToSeconds(transcript[i + 1].time) : start + 10;
      return `${fmtVtt(start)} --> ${fmtVtt(end)}\n${l.speaker}: ${l.text}`;
    }).join('\n\n');
    downloadFile(`WEBVTT\n\n${lines}`, 'transcript.vtt');
    setShowExportMenu(false);
  };

  // Close all menus on outside click
  useEffect(() => {
    const anyOpen = showSpeed || showExportMenu || showTranscriptMenu || showLangMenu;
    if (!anyOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (showSpeed && speedRef.current && !speedRef.current.contains(t)) setShowSpeed(false);
      if (showExportMenu) setShowExportMenu(false);
      if (showTranscriptMenu) setShowTranscriptMenu(false);
      if (showLangMenu) setShowLangMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSpeed, showExportMenu, showTranscriptMenu, showLangMenu]);

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    const r = progressRef.current.getBoundingClientRect();
    setProgress(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };

  const handleProgressDrag = (e: React.MouseEvent) => {
    if (e.buttons !== 1 || !progressRef.current) return;
    const r = progressRef.current.getBoundingClientRect();
    setProgress(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };

  const transcriptModes: { key: TranscriptMode; label: string }[] = [
    { key: 'original', label: t('listen.modeOriginal') },
    { key: 'translated', label: t('listen.modeTranslated') },
    { key: 'trans-top', label: t('listen.modeTransTop') },
    { key: 'trans-bottom', label: t('listen.modeTransBottom') },
  ];

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6">
      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground truncate">The Future of AI & Creativity</h1>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setChatOpen(true)} className="h-8 px-3 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm inline-flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> {t('home.chat')}
          </button>
          <SummaryButton podcastId={id!} />
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
            {/* Waveform visualization */}
            <div className="flex items-end justify-center gap-[3px] h-14 mb-3">
              {Array.from({ length: 40 }).map((_, i) => {
                const isPlayed = (i / 40) * 100 < progress;
                const baseH = 20 + Math.sin(i * 0.6) * 14 + Math.cos(i * 0.3) * 8;
                return (
                  <div
                    key={i}
                    className={`w-[3px] rounded-t-full transition-colors duration-200 origin-bottom ${isPlayed ? 'bg-accent' : 'bg-muted-foreground/20'}`}
                    style={{
                      height: `${baseH}%`,
                      ...(playing ? {
                        animation: `waveGrow 1.2s ease-in-out infinite alternate`,
                        animationDelay: `${-i * 60}ms`,
                      } : {}),
                    }}
                  />
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div
                ref={progressRef}
                className="w-full h-1.5 bg-secondary rounded-full cursor-pointer group relative"
                onClick={handleProgressClick}
                onMouseMove={handleProgressDrag}
              >
                <div className="h-full bg-accent rounded-full relative" style={{ width: `${progress}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-accent border-2 border-background shadow-md scale-0 group-hover:scale-100 transition-transform" />
                </div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">15:52</span>
                <span className="font-mono text-[10px] text-muted-foreground">45:23</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setProgress(prev => Math.max(0, prev - (10 / totalDuration) * 100))} className="text-muted-foreground hover:text-foreground transition-colors relative">
                <RotateCcw className="h-5 w-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
              </button>
              <button onClick={() => setPlaying(!playing)}
                className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button onClick={() => setProgress(prev => Math.min(100, prev + (10 / totalDuration) * 100))} className="text-muted-foreground hover:text-foreground transition-colors relative">
                <RotateCw className="h-5 w-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
              </button>
              {/* Speed selector */}
              <div className="relative" ref={speedRef}>
                <button onClick={() => setShowSpeed(!showSpeed)}
                  className="h-7 px-3 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1"
                >
                  {speed}x <ChevronDown className="h-3 w-3" />
                </button>
                {showSpeed && (
                  <div className="absolute bottom-full mb-2 right-0 bg-card border border-border rounded-2xl p-1.5 shadow-lg min-w-[72px] animate-scale-in">
                    {speeds.map(s => (
                      <button key={s} onClick={() => { setSpeed(s); setShowSpeed(false); }}
                        className={`w-full px-3 py-1.5 text-xs text-center font-medium rounded-full transition-colors ${
                          speed === s ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-secondary'
                        }`}>{s}x</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transcript */}
          <div ref={transcriptContainerRef} className="rounded-2xl bg-card border border-border p-4 max-h-[380px] overflow-y-auto scrollbar-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('listen.transcript')}</p>
                {/* Export */}
                <div className="relative">
                  <button onClick={() => setShowExportMenu(!showExportMenu)}
                    className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl py-1 shadow-lg min-w-[80px] z-10 animate-scale-in">
                      <button onClick={exportTxt} className="block w-full px-3 py-1.5 text-[11px] text-left text-foreground hover:bg-secondary transition-colors">.txt</button>
                      <button onClick={exportSrt} className="block w-full px-3 py-1.5 text-[11px] text-left text-foreground hover:bg-secondary transition-colors">.srt</button>
                      <button onClick={exportVtt} className="block w-full px-3 py-1.5 text-[11px] text-left text-foreground hover:bg-secondary transition-colors">.vtt</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Target language selector - show when not original-only */}
                {transcriptMode !== 'original' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowLangMenu(!showLangMenu)}
                      className="h-7 px-2.5 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      {targetLangs.find(l => l.code === targetLang)?.label}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showLangMenu && (
                      <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl py-1 shadow-lg min-w-[100px] z-10 animate-scale-in">
                        {targetLangs.map(l => (
                          <button key={l.code} onClick={() => { setTargetLang(l.code); setShowLangMenu(false); }}
                            className={`block w-full px-3 py-1.5 text-[11px] text-left transition-colors ${
                              targetLang === l.code ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-secondary'
                            }`}>{l.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Translation mode selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowTranscriptMenu(!showTranscriptMenu)}
                    className="h-7 px-2.5 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Languages className="h-3 w-3" />
                    {transcriptModes.find(m => m.key === transcriptMode)?.label}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showTranscriptMenu && (
                    <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl p-1 shadow-lg min-w-[140px] z-10 animate-scale-in">
                      {transcriptModes.map(m => (
                        <button key={m.key} onClick={() => { setTranscriptMode(m.key); setShowTranscriptMenu(false); }}
                          className={`block w-full px-3 py-1.5 text-[11px] rounded-lg text-left transition-colors ${
                            transcriptMode === m.key ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground hover:bg-secondary'
                          }`}>{m.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Speaker filter */}
            <div className="flex items-center gap-1.5 mb-3">
              <button onClick={() => setSpeakerFilter(null)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                  !speakerFilter ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}>All</button>
              {speakers.map(s => (
                <button key={s} onClick={() => setSpeakerFilter(speakerFilter === s ? null : s)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                    speakerFilter === s ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}>{s}</button>
              ))}
            </div>
            <div className="space-y-3">
              {transcript.filter(l => !speakerFilter || l.speaker === speakerFilter).map((l, i) => {
                const origIndex = transcript.indexOf(l);
                const isActive = origIndex === activeLineIndex;
                return (
                <div key={i} ref={isActive ? activeLineRef : undefined}
                  onClick={() => setProgress((timeToSeconds(l.time) / totalDuration) * 100)}
                  className={`cursor-pointer -mx-2 px-2 py-1.5 rounded-lg transition-all duration-300 ${
                    isActive ? 'bg-accent/10 border-l-2 border-accent pl-3' : 'hover:bg-secondary/50'
                  }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[11px] font-semibold ${l.color}`}>{l.speaker}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{l.time}</span>
                  </div>
                  {transcriptMode === 'original' && (
                    <p className="text-[13px] text-foreground leading-relaxed">{l.text}</p>
                  )}
                  {transcriptMode === 'translated' && (
                    <p className="text-[13px] text-foreground leading-relaxed">{l.translation}</p>
                  )}
                  {transcriptMode === 'trans-top' && (
                    <>
                      <p className="text-[13px] text-foreground leading-relaxed">{l.translation}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">{l.text}</p>
                    </>
                  )}
                  {transcriptMode === 'trans-bottom' && (
                    <>
                      <p className="text-[13px] text-foreground leading-relaxed">{l.text}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">{l.translation}</p>
                    </>
                  )}
                </div>
                );
              })}
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
      <FloatingChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
