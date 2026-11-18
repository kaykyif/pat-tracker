import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

type Upload = {
  id: number;
  reference_date: string;
  total_pats: number;
  total_mxm: number;
};

type Ctx = {
  uploads: Upload[];
  recentId: number | null;
  previousId: number | null;
  setRecentId: (id: number) => void;
  setPreviousId: (id: number) => void;
  currentResult: any;
  loading: boolean;
  refreshUploads: () => Promise<void>;
  refreshBacklog: () => Promise<void>;
};

const AnalysisContext = createContext<Ctx>({ 
  uploads: [], 
  recentId: null, 
  previousId: null, 
  setRecentId: () => {}, 
  setPreviousId: () => {}, 
  currentResult: null, 
  loading: false,
  refreshUploads: async () => {},
  refreshBacklog: async () => {} 
});

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [recentId, setRecentId] = useState<number | null>(null);
  const [previousId, setPreviousId] = useState<number | null>(null);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refreshUploads = async () => {
    try {
      const data = await apiClient.get('/uploads');
      setUploads(data);
      if (data.length >= 2 && recentId === null && previousId === null) {
        setRecentId(data[0].id);
        setPreviousId(data[1].id);
      }
    } catch (e: any) {
      toast.error("Erro ao carregar uploads", { description: e.message });
    }
  };

  useEffect(() => {
    refreshUploads();
  }, []);

  const fetchBacklog = () => {
    if (recentId !== null && previousId !== null) {
      setLoading(true);
      return apiClient.post('/reports/backlog', { recent_id: recentId, previous_id: previousId })
        .then(res => {
          res.totalRecent = uploads.find(u => u.id === recentId)?.total_pats;
          res.totalPrevious = uploads.find(u => u.id === previousId)?.total_pats;
          res.mxmRecent = uploads.find(u => u.id === recentId)?.total_mxm;
          res.mxmPrevious = uploads.find(u => u.id === previousId)?.total_mxm;
          res.sheetRecent = uploads.find(u => u.id === recentId)?.reference_date;
          res.sheetPrevious = uploads.find(u => u.id === previousId)?.reference_date;
          res.dateRecent = res.sheetRecent;
          res.datePrevious = res.sheetPrevious;
          setCurrentResult(res);
        })
        .catch(e => {
          toast.error("Erro ao gerar backlog", { description: e.message });
          setCurrentResult(null);
        })
        .finally(() => setLoading(false));
    }
    return Promise.resolve();
  };

  useEffect(() => {
    fetchBacklog();
  }, [recentId, previousId, uploads]);

  const refreshBacklog = async () => {
    await fetchBacklog();
  };

  return <AnalysisContext.Provider value={{ uploads, recentId, previousId, setRecentId, setPreviousId, currentResult, loading, refreshUploads, refreshBacklog }}>{children}</AnalysisContext.Provider>;
}

export const useAnalysis = () => useContext(AnalysisContext);