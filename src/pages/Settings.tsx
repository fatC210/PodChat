import { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Sun, Moon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

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

  const StatusDot = ({ k }: { k: string }) => {
    const s = status[k];
    if (s === 'testing') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    if (s === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    if (s === 'fail') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return null;
  };

  const KeyInput = ({ id, label, placeholder, value, onChange }: any) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show[id] ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full h-9 px-3 pr-8 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button onClick={() => toggle(id)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show[id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <button onClick={() => test(id)} className="h-9 px-3 rounded-lg bg-secondary text-xs font-medium text-secondary-foreground hover:bg-surface-hover transition-colors shrink-0">
          {t('common.testConnection')}
        </button>
      </div>
    </div>
  );

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
                  theme === th ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
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
                  lang === l ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {l === 'en' ? 'English' : '中文'}
              </button>
            ))}
          </div>
        </div>

        {/* API Sections */}
        {[
          { key: 'elevenlabs', title: t('settings.elevenlabs'), desc: t('settings.elevenlabsDesc'), fields: [
            { id: 'elevenlabs', label: t('settings.apiKey'), placeholder: 'sk_...' },
          ]},
          { key: 'firecrawl', title: t('settings.firecrawl'), desc: t('settings.firecrawlDesc'), fields: [
            { id: 'firecrawl', label: t('settings.apiKey'), placeholder: 'fc-...' },
          ]},
        ].map(section => (
          <div key={section.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                <p className="text-xs text-muted-foreground">{section.desc}</p>
              </div>
              <StatusDot k={section.key} />
            </div>
            {section.fields.map(f => (
              <KeyInput key={f.id} {...f} value={(keys as any)[f.id] || ''} onChange={(e: any) => setKeys(p => ({ ...p, [f.id]: e.target.value }))} />
            ))}
          </div>
        ))}

        {/* LLM */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t('settings.llm')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.llmDesc')}</p>
            </div>
            <StatusDot k="llm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{t('settings.baseUrl')}</label>
            <input value={keys.llmUrl} onChange={e => setKeys(p => ({ ...p, llmUrl: e.target.value }))} placeholder="https://api.openai.com/v1"
              className="w-full h-9 px-3 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <KeyInput id="llmKey" label={t('settings.apiKey')} placeholder="sk-..." value={keys.llmKey} onChange={(e: any) => setKeys(p => ({ ...p, llmKey: e.target.value }))} />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">{t('settings.modelName')}</label>
              <input value={keys.llmModel} onChange={e => setKeys(p => ({ ...p, llmModel: e.target.value }))} placeholder="gpt-4o"
                className="w-full h-9 px-3 rounded-lg bg-secondary border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div className="flex items-end">
              <button onClick={() => test('llm')} className="h-9 px-3 rounded-lg bg-secondary text-xs font-medium text-secondary-foreground hover:bg-surface-hover transition-colors shrink-0">
                {t('common.testConnection')}
              </button>
            </div>
          </div>
        </div>

        <button className="w-full h-10 rounded-lg bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity">
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
