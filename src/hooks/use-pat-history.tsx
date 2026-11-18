import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export type HistoryEvent = any;

export function usePatHistory(patId: string | null) {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patId) {
      setHistory([]);
      return;
    }
    
    setLoading(true);
    let isMounted = true;
    
    apiClient.get(`/reports/pat-history/${patId}`)
      .then((res: any) => {
        if (isMounted) {
          setHistory(res.history || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          toast.error("Erro ao carregar histórico do PAT", { description: err.message });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });
      
    return () => {
      isMounted = false;
    };
  }, [patId]);

  return { history, loading };
}
