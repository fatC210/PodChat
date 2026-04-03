import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Sun, Moon, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const [elevenlabsKey, setElevenlabsKey] = useState('');
  const [firecrawlKey, setFirecrawlKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({});

  const toggleShow = (key: string) => setShowKeys(p => ({ ...p, [key]: !p[key] }));

  const testConnection = (service: string) => {
    setTestStatus(p => ({ ...p, [service]: 'testing' }));
    setTimeout(() => {
      setTestStatus(p => ({ ...p, [service]: Math.random() > 0.3 ? 'ok' : 'fail' }));
    }, 1500);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'testing') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === 'fail') return <XCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-foreground">{t('settings.theme')}</h3>
            </div>
            <div className="flex items-center bg-surface rounded-lg p-0.5">
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  theme === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="h-3 w-3" />
                {t('settings.dark')}
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  theme === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="h-3 w-3" />
                {t('settings.light')}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground">{t('settings.language')}</h3>
            <div className="flex items-center bg-surface rounded-lg p-0.5">
              <button
                onClick={() => setLang('en')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  lang === 'en' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('zh')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  lang === 'zh' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                中文
              </button>
            </div>
          </div>
        </div>

        {/* ElevenLabs */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-semibold text-foreground">{t('settings.elevenlabs')}</h3>
            <StatusIcon status={testStatus.elevenlabs || 'idle'} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">{t('settings.elevenlabsDesc')}</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.apiKey')}</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKeys.el ? 'text' : 'password'}
                    value={elevenlabsKey}
                    onChange={e => setElevenlabsKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full h-9 px-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={() => toggleShow('el')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKeys.el ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <button onClick={() => testConnection('elevenlabs')} className="h-9 px-3 rounded-md bg-surface text-xs font-medium text-foreground hover:bg-surface-hover transition-colors whitespace-nowrap">
                  {t('common.testConnection')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Firecrawl */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-semibold text-foreground">{t('settings.firecrawl')}</h3>
            <StatusIcon status={testStatus.firecrawl || 'idle'} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">{t('settings.firecrawlDesc')}</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.apiKey')}</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showKeys.fc ? 'text' : 'password'}
                  value={firecrawlKey}
                  onChange={e => setFirecrawlKey(e.target.value)}
                  placeholder="fc-..."
                  className="w-full h-9 px-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={() => toggleShow('fc')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKeys.fc ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button onClick={() => testConnection('firecrawl')} className="h-9 px-3 rounded-md bg-surface text-xs font-medium text-foreground hover:bg-surface-hover transition-colors whitespace-nowrap">
                {t('common.testConnection')}
              </button>
            </div>
          </div>
        </div>

        {/* LLM */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-semibold text-foreground">{t('settings.llm')}</h3>
            <StatusIcon status={testStatus.llm || 'idle'} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">{t('settings.llmDesc')}</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.baseUrl')}</label>
              <input
                type="url"
                value={llmBaseUrl}
                onChange={e => setLlmBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full h-9 px-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.apiKey')}</label>
              <div className="relative">
                <input
                  type={showKeys.llm ? 'text' : 'password'}
                  value={llmKey}
                  onChange={e => setLlmKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full h-9 px-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={() => toggleShow('llm')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKeys.llm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.modelName')}</label>
                <input
                  type="text"
                  value={llmModel}
                  onChange={e => setLlmModel(e.target.value)}
                  placeholder="gpt-4o"
                  className="w-full h-9 px-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-end">
                <button onClick={() => testConnection('llm')} className="h-9 px-3 rounded-md bg-surface text-xs font-medium text-foreground hover:bg-surface-hover transition-colors whitespace-nowrap">
                  {t('common.testConnection')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <button className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
