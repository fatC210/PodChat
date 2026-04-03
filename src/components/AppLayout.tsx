import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Settings, ChevronLeft, Sun, Moon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import logo from '@/assets/logo.svg';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Determine back link: summary/settings pages go back to listen page
  const podcastMatch = location.pathname.match(/^\/podcast\/([^/]+)\/(summary|settings)$/);
  const backTo = podcastMatch ? `/podcast/${podcastMatch[1]}/listen` : '/';

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="max-w-screen-lg mx-auto flex h-12 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            {!isHome && (
              <Link to={backTo} className="mr-1 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            )}
            <Link to="/" className="flex items-center gap-2 group">
              <img src={logo} alt="PodChat" className="h-8 w-8" />
              <span className="font-semibold text-foreground text-[15px] tracking-tight">
                {t('app.name')}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="h-7 px-2 rounded-md text-muted-foreground hover:text-foreground transition-colors text-xs"
            >
              {lang === 'en' ? '中文' : 'EN'}
            </button>
            <button
              onClick={toggleTheme}
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <Link
              to="/settings"
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>
      <div className="pt-12">{children}</div>
    </div>
  );
}
