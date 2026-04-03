import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function PodcastSettingsPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [q, setQ] = useState('');
  const [resp, setResp] = useState('');

  const preview = () => {
    if (!q.trim()) return;
    setResp("That's a great question! Based on our episode, AI creativity operates through pattern recognition at massive scale. The key insight from Dr. Kim is that emotional resonance doesn't depend on the creator's consciousness.");
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
                <textarea defaultValue={f.v} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
              </div>
            ))}
          </div>
        </section>

        {/* Knowledge */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('podSettings.knowledgeBase')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-bold text-accent">24</p>
              <p className="text-[11px] text-muted-foreground">{t('podSettings.scriptChunks')}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-bold text-accent">8</p>
              <p className="text-[11px] text-muted-foreground">{t('podSettings.crawledPages')}</p>
            </div>
          </div>
        </section>

        {/* Preview */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('podSettings.previewChat')}</h3>
          <div className="flex gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && preview()}
              placeholder="Ask a test question..."
              className="flex-1 h-9 px-3 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
            <button onClick={preview}
              className="h-9 w-9 rounded-lg bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          {resp && <div className="mt-2 p-3 rounded-xl bg-card border border-border text-[13px] text-foreground leading-relaxed animate-fade-in">{resp}</div>}
        </section>

        {/* Danger */}
        <section className="pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-destructive mb-2">{t('podSettings.dangerZone')}</h3>
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
            <Trash2 className="h-3 w-3" /> {t('podSettings.deletePodcast')}
          </button>
        </section>

        <button className="w-full h-10 rounded-lg bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity">
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
