import { Link } from 'react-router-dom';
import { Plus, Headphones, MessageCircle, Zap, Clock, User, ArrowRight, Radio } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const mockPodcasts = [
  {
    id: 'demo-1',
    title: 'The Future of AI & Creativity',
    duration: '45:23',
    created: 'Apr 1',
    aiHost: 'Alex Chen',
    status: 'ready' as const,
    color: 'from-primary/15 to-accent/10',
  },
  {
    id: 'demo-2',
    title: 'Deep Dive: Quantum Computing Explained',
    duration: '1:20:05',
    created: 'Mar 28',
    aiHost: null,
    status: 'configuring' as const,
    color: 'from-accent/15 to-primary/10',
  },
];

export default function Index() {
  const { t } = useI18n();

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-10">
      {/* Hero */}
      <div className="mb-12">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-[1.1]">
          {t('home.title')}
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">{t('app.tagline')}</p>
      </div>

      {/* New Podcast CTA */}
      <Link
        to="/podcast/new"
        className="group flex items-center justify-between p-5 rounded-2xl border border-dashed border-border hover:border-accent/40 hover:bg-accent/5 transition-all duration-300 mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <Plus className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-[15px]">{t('home.newPodcast')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('home.emptyDesc')}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
      </Link>

      {/* Podcast list */}
      <div className="space-y-4">
        {mockPodcasts.map((podcast, i) => (
          <div
            key={podcast.id}
            className="group relative rounded-2xl bg-card border border-border overflow-hidden hover:border-foreground/10 transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Subtle gradient strip */}
            <div className={`absolute inset-0 bg-gradient-to-r ${podcast.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="relative p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Radio className="h-4 w-4 text-accent flex-shrink-0" />
                    <h3 className="font-semibold text-foreground text-lg truncate">
                      {podcast.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground ml-[26px]">
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

                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                  podcast.status === 'ready'
                    ? 'bg-success/10 text-success'
                    : 'bg-accent/10 text-accent'
                }`}>
                  {podcast.status === 'ready' ? t('home.status.ready') : t('home.status.configuring')}
                </span>
              </div>

              {podcast.status === 'ready' ? (
                <div className="flex items-center gap-2 mt-4 ml-[26px]">
                  {[
                    { to: `/podcast/${podcast.id}/listen`, icon: Headphones, label: t('home.listen') },
                    { to: `/podcast/${podcast.id}/chat`, icon: MessageCircle, label: t('home.chat') },
                    { to: `/podcast/${podcast.id}/summary`, icon: Zap, label: t('home.summary') },
                  ].map(btn => (
                    <Link
                      key={btn.to}
                      to={btn.to}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-surface-hover transition-colors"
                    >
                      <btn.icon className="h-3 w-3" />
                      {btn.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-4 ml-[26px]">
                  <Link
                    to="/podcast/new"
                    className="inline-flex items-center gap-1 text-xs text-accent font-medium hover:underline"
                  >
                    {t('home.continueSetup')}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
