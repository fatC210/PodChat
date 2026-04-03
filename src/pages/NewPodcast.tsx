import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Mic, Users, User, Play, Check, ChevronRight, ChevronLeft, Loader2, Volume2, FileAudio, Sparkles, BookOpen, Brain } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const STEPS = [
  { key: 'step1', icon: Upload },
  { key: 'step2', icon: Users },
  { key: 'step3', icon: Mic },
  { key: 'step4', icon: FileAudio },
  { key: 'step5', icon: User },
  { key: 'step6', icon: Volume2 },
  { key: 'step7', icon: Sparkles },
  { key: 'step8', icon: BookOpen },
  { key: 'step9', icon: Brain },
];

export default function NewPodcastPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [podcastType, setPodcastType] = useState<'solo' | 'multi'>('solo');
  const [refCount, setRefCount] = useState(2);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const currentStep = STEPS[step];

  const canNext = () => {
    if (step === 0) return !!uploadedFile;
    if (step === 4) return !!selectedHost;
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && /\.(mp3|wav|m4a)$/i.test(file.name)) {
      setUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const mockSpeakers = [
    { id: 's1', name: 'Speaker 1', duration: '62%', lines: ['Welcome everyone to today\'s episode...', 'That\'s a great point, let me expand...', 'So to summarize what we discussed...'] },
    { id: 's2', name: 'Speaker 2', duration: '38%', lines: ['Thanks for having me here today...', 'I think the key insight is...', 'Absolutely, and one more thing...'] },
  ];

  return (
    <div className="container py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('wizard.title')}</h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.key} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isDone
                    ? 'bg-surface text-foreground hover:bg-surface-hover cursor-pointer'
                    : 'text-muted-foreground cursor-default'
                }`}
              >
                {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{t(`wizard.${s.key}` as any)}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className={`h-3 w-3 mx-0.5 flex-shrink-0 ${i < step ? 'text-muted-foreground' : 'text-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-card border border-border rounded-xl p-6 min-h-[400px] animate-fade-in">
        <h2 className="font-display text-xl font-semibold text-foreground mb-1">
          {t(`wizard.${currentStep.key}` as any)}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t(`wizard.${currentStep.key}Desc` as any)}
        </p>

        {/* Step 1: Upload */}
        {step === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              uploadedFile ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-muted-foreground'
            }`}
          >
            {uploadedFile ? (
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <FileAudio className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium text-foreground">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <button
                  onClick={() => setUploadedFile(null)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center mx-auto">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t('wizard.upload.drag')}</p>
                <p className="text-xs text-muted-foreground">{t('wizard.upload.or')}</p>
                <label className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-surface text-sm font-medium text-foreground hover:bg-surface-hover cursor-pointer transition-colors">
                  {t('wizard.upload.browse')}
                  <input type="file" accept=".mp3,.wav,.m4a" className="hidden" onChange={handleFileSelect} />
                </label>
                <p className="text-xs text-muted-foreground">{t('wizard.upload.formats')}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Type */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPodcastType('solo')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  podcastType === 'solo' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <User className={`h-6 w-6 mb-2 ${podcastType === 'solo' ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-medium text-foreground text-sm">{t('wizard.type.solo')}</p>
              </button>
              <button
                onClick={() => setPodcastType('multi')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  podcastType === 'multi' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <Users className={`h-6 w-6 mb-2 ${podcastType === 'multi' ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-medium text-foreground text-sm">{t('wizard.type.multi')}</p>
              </button>
            </div>
            {podcastType === 'multi' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('wizard.type.refCount')}
                </label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={refCount}
                  onChange={e => setRefCount(Number(e.target.value))}
                  className="w-24 h-9 px-3 rounded-md bg-surface border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Speaker Detection */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-surface">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t('wizard.detected', { count: '2' })}
              </p>
            </div>
            <div className="grid gap-3">
              {mockSpeakers.map(sp => (
                <div key={sp.id} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground text-sm">{sp.name}</span>
                    <span className="text-xs text-muted-foreground">{sp.duration}</span>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Play className="h-3 w-3" /> Listen to sample
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Script */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-surface rounded-xl p-4 max-h-64 overflow-y-auto space-y-3 text-sm">
              <div>
                <span className="text-xs text-primary font-medium">[00:00:15] Speaker 1</span>
                <p className="text-foreground mt-0.5">Welcome everyone to today's episode. We have a fantastic topic lined up — the intersection of AI and human creativity.</p>
              </div>
              <div>
                <span className="text-xs text-info font-medium">[00:00:32] Speaker 2</span>
                <p className="text-foreground mt-0.5">Thanks for having me! I've been thinking about this a lot lately, especially with the recent advances in generative AI.</p>
              </div>
              <div>
                <span className="text-xs text-primary font-medium">[00:01:05] Speaker 1</span>
                <p className="text-foreground mt-0.5">Let's dive right in. The big question everyone's asking is — can AI truly be creative, or is it just remixing what already exists?</p>
              </div>
              <div>
                <span className="text-xs text-info font-medium">[00:01:28] Speaker 2</span>
                <p className="text-foreground mt-0.5">That's the fundamental question. I'd argue that what we call "creativity" in humans is also a form of remixing — we're influenced by everything we've ever experienced.</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Select Host */}
        {step === 4 && (
          <div className="grid gap-3">
            {mockSpeakers.map(sp => (
              <button
                key={sp.id}
                onClick={() => setSelectedHost(sp.id)}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  selectedHost === sp.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-semibold text-foreground">{sp.name}</span>
                  {selectedHost === sp.id && (
                    <span className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {sp.lines.map((line, i) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">"{line}"</p>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 6: Voice Cloning */}
        {step === 5 && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Volume2 className="h-10 w-10 text-primary animate-pulse-soft" />
            </div>
            <p className="text-sm text-foreground font-medium">{t('wizard.cloning')}</p>
            <div className="w-48 h-1.5 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse-soft" style={{ width: '65%' }} />
            </div>
            <p className="text-xs text-muted-foreground">Extracting high-quality voice samples...</p>
          </div>
        )}

        {/* Step 7: Voice Design */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-surface">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Style: Energetic & Warm</p>
                <p className="text-xs text-muted-foreground">Fast-paced, expressive, high similarity</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Stability', value: 42 },
                { label: 'Similarity', value: 78 },
                { label: 'Style', value: 65 },
                { label: 'Speed', value: 72 },
              ].map(param => (
                <div key={param.label} className="p-3 rounded-lg bg-surface">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{param.label}</span>
                    <span className="text-foreground font-medium">{param.value}</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${param.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 8: Knowledge Base */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Script Chunks', value: '24' },
                { label: 'Crawled Pages', value: '8' },
                { label: 'Total Entries', value: '156' },
              ].map(stat => (
                <div key={stat.label} className="p-4 rounded-xl bg-surface text-center">
                  <p className="font-display text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl bg-surface space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">URLs found in transcript:</p>
              {['https://arxiv.org/abs/2401.xxxxx', 'https://openai.com/research/...'].map(url => (
                <div key={url} className="flex items-center gap-2 text-xs">
                  <Check className="h-3 w-3 text-success flex-shrink-0" />
                  <span className="text-foreground truncate">{url}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 9: Persona */}
        {step === 8 && (
          <div className="space-y-4">
            {[
              { label: t('podSettings.personality'), value: 'Enthusiastic, analytical, uses analogies frequently' },
              { label: t('podSettings.catchphrases'), value: '"That\'s a great point", "Let me break this down", "Here\'s the thing..."' },
              { label: t('podSettings.answerStyle'), value: 'Starts with a hook, provides examples, then summarizes' },
              { label: t('podSettings.languagePref'), value: 'English with occasional technical jargon' },
            ].map(field => (
              <div key={field.label}>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{field.label}</label>
                <textarea
                  defaultValue={field.value}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('common.previous')}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {t('common.next')}
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/podcast/demo-1/listen')}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('common.confirm')}
            <Check className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
