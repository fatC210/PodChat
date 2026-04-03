import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, MessageCircle, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function PodcastSettingsPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const [testQuestion, setTestQuestion] = useState('');
  const [testResponse, setTestResponse] = useState('');

  const handlePreview = () => {
    if (!testQuestion.trim()) return;
    setTestResponse("That's a great question! Based on what we discussed in the episode, AI creativity operates through pattern recognition at massive scale. It's not 'true' creativity in the philosophical sense, but the output can be genuinely novel and useful. The key insight from Dr. Kim's research is that emotional resonance doesn't depend on the creator's consciousness.");
  };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link to={`/podcast/${id}/listen`} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('podSettings.title')}</h1>
      </div>

      <div className="space-y-6">
        {/* Persona */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">{t('podSettings.persona')}</h3>
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
                  className="w-full px-3 py-2 rounded-md bg-surface border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge Base Stats */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">{t('podSettings.knowledgeBase')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-surface text-center">
              <p className="font-display text-2xl font-bold text-primary">24</p>
              <p className="text-xs text-muted-foreground mt-1">{t('podSettings.scriptChunks')}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface text-center">
              <p className="font-display text-2xl font-bold text-primary">8</p>
              <p className="text-xs text-muted-foreground mt-1">{t('podSettings.crawledPages')}</p>
            </div>
          </div>
        </div>

        {/* Preview Chat */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">{t('podSettings.previewChat')}</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={testQuestion}
                onChange={e => setTestQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePreview()}
                placeholder="Ask a test question..."
                className="flex-1 h-9 px-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handlePreview}
                className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            {testResponse && (
              <div className="p-3 rounded-lg bg-surface text-sm text-foreground leading-relaxed animate-fade-in">
                {testResponse}
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-card border border-destructive/30 rounded-xl p-5">
          <h3 className="font-display font-semibold text-destructive mb-2">{t('podSettings.dangerZone')}</h3>
          <p className="text-xs text-muted-foreground mb-3">This action is irreversible. All data for this podcast will be permanently deleted.</p>
          <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Trash2 className="h-3.5 w-3.5" />
            {t('podSettings.deletePodcast')}
          </button>
        </div>

        <button className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
