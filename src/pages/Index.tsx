import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock, User, Radio, Zap, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';

const initialPodcasts = [
  {
    id: 'demo-1',
    title: 'The Future of AI & Creativity',
    duration: '45:23',
    created: new Date(2026, 3, 1),
    aiHost: 'Alex Chen',
    status: 'ready' as const,
    color: 'from-primary/15 to-accent/10',
  },
  {
    id: 'demo-2',
    title: 'Deep Dive: Quantum Computing Explained',
    duration: '1:20:05',
    created: new Date(2026, 2, 28),
    aiHost: null,
    status: 'configuring' as const,
    color: 'from-accent/15 to-primary/10',
  },
];

export default function Index() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [podcasts, setPodcasts] = useState(initialPodcasts);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPodcasts(p => p.filter(x => x.id !== id));
  };

  const handleCardClick = (podcast: typeof initialPodcasts[0]) => {
    if (podcast.status === 'ready') {
      nav(`/podcast/${podcast.id}/listen`);
    } else {
      nav('/podcast/new');
    }
  };

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-10">
      {/* Hero + New button */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-[1.1]">
            {t('home.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">{t('app.tagline')}</p>
        </div>
        <Link
          to="/podcast/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          {t('home.newPodcast')}
        </Link>
      </div>

      {/* Podcast list */}
      <div className="space-y-4">
        {podcasts.map((podcast, i) => (
          <div
            key={podcast.id}
            onClick={() => handleCardClick(podcast)}
            className="group relative rounded-2xl bg-card border border-border overflow-hidden hover:border-foreground/10 transition-all duration-300 animate-fade-in cursor-pointer"
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
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 ${
                      podcast.status === 'ready'
                        ? 'bg-success/10 text-success'
                        : 'bg-accent/10 text-accent'
                    }`}>
                      {podcast.status === 'ready' ? t('home.status.ready') : t('home.status.configuring')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground ml-[26px]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {podcast.duration}
                    </span>
                    <span>{podcast.created.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                    {podcast.aiHost && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {podcast.aiHost}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {podcast.status === 'ready' && (
                    <Link
                      to={`/podcast/${podcast.id}/summary`}
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
                    >
                      <Zap className="h-3 w-3" />
                      {t('home.summary')}
                    </Link>
                  )}


                  <button
                    onClick={(e) => handleDelete(podcast.id, e)}
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
