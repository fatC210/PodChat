import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Users, User, Play, Check, ChevronRight, ChevronLeft, Volume2, FileAudio, Sparkles, BookOpen, Brain, Mic } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const STEPS = [
  { key: 'step1', icon: Upload, labelKey: 'wizard.pill.upload' },
  { key: 'step2', icon: Users, labelKey: 'wizard.pill.type' },
  { key: 'step3', icon: Mic, labelKey: 'wizard.pill.speakers' },
  { key: 'step4', icon: FileAudio, labelKey: 'wizard.pill.script' },
  { key: 'step5', icon: User, labelKey: 'wizard.pill.host' },
  { key: 'step6', icon: Volume2, labelKey: 'wizard.pill.clone' },
  { key: 'step7', icon: Sparkles, labelKey: 'wizard.pill.voice' },
  { key: 'step8', icon: BookOpen, labelKey: 'wizard.pill.knowledge' },
  { key: 'step9', icon: Brain, labelKey: 'wizard.pill.persona' },
];

const mockSpeakers = [
  { id: 's1', name: 'Speaker 1', pct: 62, preview: 'Welcome everyone to today\'s episode...' },
  { id: 's2', name: 'Speaker 2', pct: 38, preview: 'Thanks for having me here today...' },
];

export default function NewPodcastPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<'solo' | 'multi'>('solo');
  const [refCount, setRefCount] = useState(2);
  const [host, setHost] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const canNext = step === 0 ? !!file : step === 4 ? !!host : true;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground mb-6">{t('wizard.title')}</h1>

      {/* Progress — pill tabs */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-2 scrollbar-hide">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => i <= step && setStep(i)}
            disabled={i > step}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
              i === step
                ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                : i < step
                ? 'bg-secondary text-foreground border-border cursor-pointer hover:border-accent/50'
                : 'bg-secondary/50 text-muted-foreground border-border opacity-60'
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-secondary rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* Step label */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-foreground">{t(`wizard.${STEPS[step].key}` as any)}</p>
        <p className="text-xs text-muted-foreground">{t(`wizard.${STEPS[step].key}Desc` as any)}</p>
      </div>

      {/* Content */}
      <div className="min-h-[340px] animate-fade-in">
        {step === 0 && (
          <label
            className={`flex flex-col items-center justify-center h-60 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
              file ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground'
            }`}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            onDragOver={e => e.preventDefault()}
          >
            {file ? (
              <div className="text-center">
                <FileAudio className="h-8 w-8 text-accent mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                <button onClick={e => { e.preventDefault(); setFile(null); }} className="text-xs text-destructive mt-2 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('wizard.upload.drag')}</p>
                <p className="text-xs text-accent font-medium mt-2">{t('wizard.upload.browse')}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{t('wizard.upload.formats')}</p>
              </div>
            )}
            <input type="file" accept=".mp3,.wav,.m4a" className="hidden" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
          </label>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[{ k: 'solo' as const, icon: User }, { k: 'multi' as const, icon: Users }].map(opt => (
                <button key={opt.k} onClick={() => setType(opt.k)}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${
                    type === opt.k ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <opt.icon className={`h-5 w-5 mb-2 ${type === opt.k ? 'text-accent' : 'text-muted-foreground'}`} />
                  <p className="font-medium text-sm text-foreground">{t(`wizard.type.${opt.k}`)}</p>
                </button>
              ))}
            </div>
            {type === 'multi' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('wizard.type.refCount')}</label>
                <input type="number" min={2} max={10} value={refCount} onChange={e => setRefCount(+e.target.value)}
                  className="w-20 h-9 px-3 rounded-lg bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10">
              <Check className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-foreground">{t('wizard.detected', { count: '2' })}</span>
            </div>
            {mockSpeakers.map(s => (
              <div key={s.id} className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.pct}% of audio</p>
                </div>
                <button className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <Play className="h-3 w-3 ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl bg-card border border-border p-4 space-y-3 max-h-72 overflow-y-auto">
            {[
              { s: 'Speaker 1', t: '00:15', text: 'Welcome everyone to today\'s episode. We have a fantastic topic — the intersection of AI and human creativity.' },
              { s: 'Speaker 2', t: '00:32', text: 'Thanks for having me! I\'ve been thinking about this a lot lately, especially with generative AI advances.' },
              { s: 'Speaker 1', t: '01:05', text: 'Let\'s dive right in. Can AI truly be creative, or is it just remixing what already exists?' },
              { s: 'Speaker 2', t: '01:28', text: 'That\'s the fundamental question. Human creativity is also remixing — we\'re influenced by everything we\'ve experienced.' },
            ].map((line, i) => (
              <div key={i} className="hover:bg-secondary/50 -mx-1 px-1 py-1 rounded-lg transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{line.t}</span>
                  <span className={`text-xs font-semibold ${i % 2 === 0 ? 'text-accent' : 'text-info'}`}>{line.s}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{line.text}</p>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            {mockSpeakers.map(s => (
              <button key={s.id} onClick={() => setHost(s.id)}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                  host === s.id ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground">{s.name}</span>
                  {host === s.id && <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center"><Check className="h-3 w-3 text-accent-foreground" /></div>}
                </div>
                <p className="text-xs text-muted-foreground">"{s.preview}"</p>
              </button>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col items-center py-12">
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <Volume2 className="h-8 w-8 text-accent" />
            </div>
            <p className="text-sm font-medium text-foreground">{t('wizard.cloning')}</p>
            <div className="w-40 h-1 bg-secondary rounded-full mt-3 overflow-hidden">
              <div className="h-full w-2/3 bg-accent rounded-full" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-accent/10 flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-accent" />
              <div>
                <p className="text-sm font-medium text-foreground">Energetic & Expressive</p>
                <p className="text-xs text-muted-foreground">Fast-paced, warm, high similarity</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ l: 'Stability', v: 42 }, { l: 'Similarity', v: 78 }, { l: 'Style', v: 65 }, { l: 'Speed', v: 72 }].map(p => (
                <div key={p.l} className="p-3 rounded-xl bg-card border border-border">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{p.l}</span>
                    <span className="font-mono text-foreground">{p.v}</span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full"><div className="h-full bg-accent rounded-full" style={{ width: `${p.v}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{ l: 'Chunks', v: '24' }, { l: 'Pages', v: '8' }, { l: 'Entries', v: '156' }].map(s => (
                <div key={s.l} className="p-4 rounded-xl bg-card border border-border text-center">
                  <p className="text-2xl font-bold text-accent">{s.v}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-3">
            {[
              { l: t('podSettings.personality'), v: 'Enthusiastic, analytical, uses analogies' },
              { l: t('podSettings.catchphrases'), v: '"That\'s a great point", "Let me break this down"' },
              { l: t('podSettings.answerStyle'), v: 'Hook → examples → summary' },
            ].map(f => (
              <div key={f.l}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.l}</label>
                <textarea defaultValue={f.v} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-0 transition-all">
          <ChevronLeft className="h-4 w-4" /> {t('common.previous')}
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext}
            className="inline-flex items-center gap-1 h-9 px-5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-opacity">
            {t('common.next')} <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => nav('/podcast/demo-1/listen')}
            className="inline-flex items-center gap-1 h-9 px-5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            {t('common.confirm')} <Check className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
