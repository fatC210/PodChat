import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import SettingsPage from "./pages/Settings";
import NewPodcastPage from "./pages/NewPodcast";
import ListenPage from "./pages/Listen";
import SummaryPage from "./pages/Summary";
import PodcastSettingsPage from "./pages/PodcastSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/podcast/new" element={<NewPodcastPage />} />
                <Route path="/podcast/:id/listen" element={<ListenPage />} />
                <Route path="/podcast/:id/summary" element={<SummaryPage />} />
                <Route path="/podcast/:id/settings" element={<PodcastSettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
