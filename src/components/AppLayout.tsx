import { Link, useLocation } from 'react-router-dom';
import { Settings, Home, Sun, Moon, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            {!isHome && (
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors mr-1">
                <Home className="h-4 w-4" />
              </Link>
            )}
            <Link to="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-sm">P</span>
              </div>
              <span className="font-display font-semibold text-foreground text-lg tracking-tight">
                PodChat
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="h-8 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === 'en' ? '中文' : 'EN'}
            </button>
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors flex items-center justify-center"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <Link
              to="/settings"
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors flex items-center justify-center"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="animate-fade-in">
        {children}
      </main>
    </div>
  );
}
