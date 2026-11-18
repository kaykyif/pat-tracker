import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnalysisProvider } from "@/hooks/use-analysis";
import AppLayout from "@/components/app-layout";
import Dashboard from "./pages/Dashboard";
import QuadroDiretoria from "./pages/QuadroDiretoria";
import NewAnalysis from "./pages/NewAnalysis";
import History from "./pages/History";
import SettingsPage from "./pages/Settings";
import PatsInfoGerais from "./pages/PatsInfoGerais";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnalysisProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/quadro" element={<QuadroDiretoria />} />
              <Route path="/nova-analise" element={<NewAnalysis />} />
              <Route path="/historico" element={<History />} />
              <Route path="/pats" element={<PatsInfoGerais />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnalysisProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
