import { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Sun, Moon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

function StatusDot({ status }: { status?: string }) {
  if (status === 'testing') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (status === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === 'fail') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return null;
}

function KeyInput({ id, label, placeholder, value, onChange, show, onToggle, onTest, testLabel }: {
  id: string; label: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean; onToggle: () => void; onTest: () => void; testLabel: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full h-9 px-3 pr-8 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={onToggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <button onClick={onTest} className="h-9 px-3 rounded-lg bg-secondary text-xs font-medium text-secondary-foreground hover:bg-surface-hover transition-colors shrink-0">
          {testLabel}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const [keys, setKeys] = useState({ elevenlabs: '', firecrawl: '', llmKey: '', llmUrl: '', llmModel: '' });
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, string>>({});

  const toggle = (k: string) => setShow(p => ({ ...p, [k]: !p[k] }));
  const test = (k: string) => {
    setStatus(p => ({ ...p, [k]: 'testing' }));
    setTimeout(() => setStatus(p => ({ ...p, [k]: Math.random() > 0.3 ? 'ok' : 'fail' })), 1200);
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground mb-1">{t('settings.title')}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t('settings.subtitle')}</p>

      <div className="space-y-6">
        {/* Appearance row */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <span className="text-sm text-foreground">{t('settings.theme')}</span>
          <div className="flex bg-secondary rounded-lg p-0.5">
            {(['dark', 'light'] as const).map(th => (
              <button key={th} onClick={() => setTheme(th)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  theme === th ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {th === 'dark' ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                {t(`settings.${th}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-border">
          <span className="text-sm text-foreground">{t('settings.language')}</span>
          <div className="flex bg-secondary rounded-lg p-0.5">
            {(['en', 'zh'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  lang === l ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {l === 'en' ? 'English' : '中文'}
              </button>
            ))}
          </div>
        </div>

        {/* ElevenLabs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('settings.elevenlabs')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.elevenlabsDesc')}</p>
            </div>
            <StatusDot status={status.elevenlabs} />
          </div>
          <KeyInput id="elevenlabs" label={t('settings.apiKey')} placeholder="sk_..."
            value={keys.elevenlabs} onChange={e => setKeys(p => ({ ...p, elevenlabs: e.target.value }))}
            show={!!show.elevenlabs} onToggle={() => toggle('elevenlabs')} onTest={() => test('elevenlabs')} testLabel={t('common.testConnection')} />
        </div>

        {/* Firecrawl */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('settings.firecrawl')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.firecrawlDesc')}</p>
            </div>
            <StatusDot status={status.firecrawl} />
          </div>
          <KeyInput id="firecrawl" label={t('settings.apiKey')} placeholder="fc-..."
            value={keys.firecrawl} onChange={e => setKeys(p => ({ ...p, firecrawl: e.target.value }))}
            show={!!show.firecrawl} onToggle={() => toggle('firecrawl')} onTest={() => test('firecrawl')} testLabel={t('common.testConnection')} />
        </div>

        {/* LLM */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('settings.llm')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.llmDesc')}</p>
            </div>
            <StatusDot status={status.llm} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{t('settings.baseUrl')}</label>
            <input value={keys.llmUrl} onChange={e => setKeys(p => ({ ...p, llmUrl: e.target.value }))} placeholder="https://api.openai.com/v1"
              className="w-full h-9 px-3 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <KeyInput id="llmKey" label={t('settings.apiKey')} placeholder="sk-..."
            value={keys.llmKey} onChange={e => setKeys(p => ({ ...p, llmKey: e.target.value }))}
            show={!!show.llmKey} onToggle={() => toggle('llmKey')} onTest={() => test('llm')} testLabel={t('common.testConnection')} />
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{t('settings.modelName')}</label>
            <input value={keys.llmModel} onChange={e => setKeys(p => ({ ...p, llmModel: e.target.value }))} placeholder="gpt-4o"
              className="w-full h-9 px-3 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>

        <button className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
