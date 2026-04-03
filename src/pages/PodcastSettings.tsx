import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, FileText, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

const scriptChunks = [
  { id: 1, text: 'Welcome everyone to today\'s episode! We have a really exciting topic — the intersection of AI and human creativity.' },
  { id: 2, text: 'Thanks for having me, Alex! I\'ve been thinking about this a lot lately, especially with the recent advances in generative AI.' },
  { id: 3, text: 'Can AI truly be creative, or is it just remixing what already exists?' },
  { id: 4, text: 'That\'s the fundamental question. What we call "creativity" in humans is also a form of remixing.' },
];

const crawledPages = [
  { id: 1, title: 'AI and Creativity — Stanford HAI', url: 'https://hai.stanford.edu/ai-creativity' },
  { id: 2, title: 'Generative AI Overview — MIT Tech Review', url: 'https://technologyreview.com/generative-ai' },
  { id: 3, title: 'The Future of Creative AI — Nature', url: 'https://nature.com/articles/creative-ai' },
];

export default function PodcastSettingsPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [showScripts, setShowScripts] = useState(false);
  const [showPages, setShowPages] = useState(false);

  const autoSave = () => {
    toast.success(t('settings.saved'));
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground mb-8">{t('podSettings.title')}</h1>

      <div className="space-y-6">
        {/* Persona */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('podSettings.persona')}</h3>
          <div className="space-y-3">
            {[
              { l: t('podSettings.personality'), v: 'Enthusiastic, analytical, uses analogies frequently' },
              { l: t('podSettings.catchphrases'), v: '"That\'s a great point", "Let me break this down"' },
              { l: t('podSettings.answerStyle'), v: 'Starts with a hook, provides examples, then summarizes' },
              { l: t('podSettings.languagePref'), v: 'English with occasional technical jargon' },
            ].map(f => (
              <div key={f.l}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.l}</label>
                <textarea defaultValue={f.v} rows={2} onBlur={autoSave}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
              </div>
            ))}
          </div>
        </section>

        {/* Knowledge Base */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('podSettings.knowledgeBase')}</h3>

          {/* Script Chunks */}
          <div className="mb-2">
            <button
              onClick={() => setShowScripts(!showScripts)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">{t('podSettings.scriptChunks')}</span>
                <span className="text-xs text-muted-foreground">({scriptChunks.length})</span>
              </div>
              {showScripts ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showScripts && (
              <div className="mt-1 space-y-1 animate-fade-in">
                {scriptChunks.map(c => (
                  <div key={c.id} className="px-3 py-2 rounded-lg bg-secondary/50 text-xs text-foreground leading-relaxed">
                    <span className="text-muted-foreground mr-1.5">#{c.id}</span>{c.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Crawled Pages */}
          <div>
            <button
              onClick={() => setShowPages(!showPages)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">{t('podSettings.crawledPages')}</span>
                <span className="text-xs text-muted-foreground">({crawledPages.length})</span>
              </div>
              {showPages ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showPages && (
              <div className="mt-1 space-y-1 animate-fade-in">
                {crawledPages.map(p => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="block px-3 py-2 rounded-lg bg-secondary/50 text-xs text-foreground hover:bg-secondary transition-colors">
                    <span className="text-muted-foreground mr-1.5">#{p.id}</span>
                    <span className="text-accent underline underline-offset-2">{p.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
