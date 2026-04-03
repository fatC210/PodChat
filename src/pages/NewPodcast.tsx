import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Users, User, Play, Pause, Check, ChevronRight, ChevronLeft, Volume2, FileAudio, Sparkles, BookOpen, Brain, Mic } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

// All internal steps (0-8)
const ALL_STEPS = [
  { key: 'step1', icon: Upload, labelKey: 'wizard.pill.upload', userStep: true },
  { key: 'step2', icon: Users, labelKey: 'wizard.pill.type', userStep: true },
  { key: 'step3', icon: Mic, labelKey: 'wizard.pill.speakers', userStep: false },
  { key: 'step4', icon: FileAudio, labelKey: 'wizard.pill.script', userStep: false },
  { key: 'step5', icon: User, labelKey: 'wizard.pill.host', userStep: true },
  { key: 'step6', icon: Volume2, labelKey: 'wizard.pill.clone', userStep: false },
  { key: 'step7', icon: Sparkles, labelKey: 'wizard.pill.voice', userStep: false },
  { key: 'step8', icon: BookOpen, labelKey: 'wizard.pill.knowledge', userStep: false },
  { key: 'step9', icon: Brain, labelKey: 'wizard.pill.persona', userStep: true },
];

// Only user-facing steps for the pill progress
const USER_STEPS = ALL_STEPS
  .map((s, i) => ({ ...s, internalIndex: i }))
  .filter(s => s.userStep);

const mockSpeakers = [
  { id: 's1', name: 'Speaker 1', pct: 62, preview: 'Welcome everyone to today\'s episode...' },
  { id: 's2', name: 'Speaker 2', pct: 38, preview: 'Thanks for having me here today...' },
];

export default function NewPodcastPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState(0); // internal step index (0-8)
  const [type, setType] = useState<'solo' | 'multi'>('solo');
  const [refCount, setRefCount] = useState(2);
  const [host, setHost] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Auto-advance through AI steps
  useEffect(() => {
    if (!ALL_STEPS[step].userStep) {
      const timer = setTimeout(() => {
        if (step < ALL_STEPS.length - 1) setStep(step + 1);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const canNext = step === 0 ? !!file : step === 4 ? !!host : true;

  // Find which user step we're on (or between)
  const currentUserStepIdx = (() => {
    for (let i = USER_STEPS.length - 1; i >= 0; i--) {
      if (step >= USER_STEPS[i].internalIndex) return i;
    }
    return 0;
  })();

  const handleNext = () => {
    if (!canNext) return;
    if (step < ALL_STEPS.length - 1) setStep(step + 1);
  };

  const handlePrev = () => {
    // Jump back to previous user step
    const prevUserStep = [...USER_STEPS].reverse().find(s => s.internalIndex < step);
    if (prevUserStep) setStep(prevUserStep.internalIndex);
  };

  const handlePillClick = (userIdx: number) => {
    const target = USER_STEPS[userIdx].internalIndex;
    if (target <= step) setStep(target);
  };

  const isOnAiStep = !ALL_STEPS[step].userStep;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground mb-6">{t('wizard.title')}</h1>

      {/* Progress — steps connected by dots */}
      <div className="flex items-center justify-between mb-8">
        {USER_STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => handlePillClick(i)}
              disabled={s.internalIndex > step}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all ${
                i === currentUserStepIdx
                  ? 'bg-accent border-accent text-accent-foreground shadow-md shadow-accent/20'
                  : i < currentUserStepIdx
                  ? 'bg-accent/15 border-accent text-accent cursor-pointer'
                  : 'bg-secondary border-border text-muted-foreground'
              }`}>
                {i < currentUserStepIdx ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <s.icon className="h-4 w-4" />
                )}
              </div>
              <span className={`text-[11px] font-medium transition-colors ${
                i <= currentUserStepIdx ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {t(s.labelKey as any)}
              </span>
            </button>
            {i < USER_STEPS.length - 1 && (
              <div className="flex-1 flex items-center justify-center px-2 -mt-5">
                <div className="flex items-center gap-1 w-full justify-center">
                  {[...Array(5)].map((_, d) => (
                    <div key={d} className={`h-1 w-1 rounded-full transition-colors ${
                      i < currentUserStepIdx ? 'bg-accent' : 'bg-border'
                    }`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step label */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-foreground">{t(`wizard.${ALL_STEPS[step].key}` as any)}</p>
        <p className="text-xs text-muted-foreground">{t(`wizard.${ALL_STEPS[step].key}Desc` as any)}</p>
      </div>

      {/* Content */}
      <div className="animate-fade-in">
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
            <input type="file" accept=".mp3,.wav,.m4a,.mp4,.mov,.avi,.mkv,.webm" className="hidden" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
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

        {/* AI steps 2-3: speakers & script (auto-advance) */}
        {(step === 2 || step === 3) && (
          <div className="flex flex-col items-center py-16">
            <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 animate-pulse">
              {step === 2 ? <Mic className="h-7 w-7 text-accent" /> : <FileAudio className="h-7 w-7 text-accent" />}
            </div>
            <p className="text-sm font-medium text-foreground">
              {step === 2 ? t('wizard.detecting') : t('wizard.generating')}
            </p>
            <div className="w-32 h-1 bg-secondary rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: '70%' }} />
            </div>
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
                <p className="text-xs text-muted-foreground mt-1">{s.pct}% of audio</p>
              </button>
            ))}
          </div>
        )}

        {/* AI steps 5-7: clone, voice, knowledge (auto-advance) */}
        {(step === 5 || step === 6 || step === 7) && (
          <div className="flex flex-col items-center py-16">
            <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 animate-pulse">
              {step === 5 ? <Volume2 className="h-7 w-7 text-accent" /> :
               step === 6 ? <Sparkles className="h-7 w-7 text-accent" /> :
               <BookOpen className="h-7 w-7 text-accent" />}
            </div>
            <p className="text-sm font-medium text-foreground">
              {step === 5 ? t('wizard.cloning') : step === 6 ? t('wizard.analyzing') : t('wizard.building')}
            </p>
            <div className="w-32 h-1 bg-secondary rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: '70%' }} />
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

      {/* Navigation — hide during AI steps */}
      {!isOnAiStep && (
        <div className="flex items-center justify-between mt-6 pt-4">
          <button onClick={handlePrev} disabled={step === 0}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-0 transition-all">
            <ChevronLeft className="h-4 w-4" /> {t('common.previous')}
          </button>
          {step < ALL_STEPS.length - 1 ? (
            <button onClick={handleNext} disabled={!canNext}
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
      )}
    </div>
  );
}
