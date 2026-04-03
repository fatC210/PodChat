import { Link } from 'react-router-dom';
import { Plus, Headphones, MessageCircle, Zap, Clock, User, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

// Mock data for demo
const mockPodcasts = [
  {
    id: 'demo-1',
    title: 'The Future of AI & Creativity',
    duration: '45:23',
    created: '2026-04-01',
    aiHost: 'Alex Chen',
    status: 'ready' as const,
  },
  {
    id: 'demo-2',
    title: 'Deep Dive: Quantum Computing',
    duration: '1:20:05',
    created: '2026-03-28',
    aiHost: null,
    status: 'configuring' as const,
  },
];

export default function Index() {
  const { t } = useI18n();

  return (
    <div className="container py-8 max-w-3xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {t('home.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('app.tagline')}</p>
        </div>
        <Link
          to="/podcast/new"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          {t('home.newPodcast')}
        </Link>
      </div>

      {mockPodcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
            <Headphones className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground mb-1">{t('home.empty')}</h2>
          <p className="text-muted-foreground text-sm max-w-sm">{t('home.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mockPodcasts.map((podcast) => (
            <div
              key={podcast.id}
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-[var(--shadow-glow)] transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground text-lg leading-tight group-hover:text-primary transition-colors">
                    {podcast.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {podcast.duration}
                    </span>
                    <span>{podcast.created}</span>
                    {podcast.aiHost && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {podcast.aiHost}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  podcast.status === 'ready'
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/10 text-warning'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    podcast.status === 'ready' ? 'bg-success' : 'bg-warning animate-pulse-soft'
                  }`} />
                  {podcast.status === 'ready' ? t('home.status.ready') : t('home.status.configuring')}
                </span>
              </div>

              {podcast.status === 'ready' ? (
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    to={`/podcast/${podcast.id}/listen`}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-surface text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <Headphones className="h-3.5 w-3.5" />
                    {t('home.listen')}
                  </Link>
                  <Link
                    to={`/podcast/${podcast.id}/chat`}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-surface text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t('home.chat')}
                  </Link>
                  <Link
                    to={`/podcast/${podcast.id}/summary`}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-surface text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {t('home.summary')}
                  </Link>
                </div>
              ) : (
                <Link
                  to="/podcast/new"
                  className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline pt-1"
                >
                  {t('home.continueSetup')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
