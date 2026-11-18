import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useAnalysis } from "./use-analysis";
import type { PatRow } from "@/lib/pat-types";

export type SnapshotResponse = {
  upload: {
    id: number;
    reference_date: string;
    total_pats: number;
    total_mxm: number;
  };
  pats: (PatRow & { manual_data?: Record<string, string> })[];
};

export function useSnapshot() {
  const { uploads } = useAnalysis();
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [data, setData] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshSnapshot = () => setRefreshTrigger(t => t + 1);

  // Default to the most recent upload if none selected
  useEffect(() => {
    if (uploadId === null && uploads.length > 0) {
      setUploadId(uploads[0].id);
    }
  }, [uploads, uploadId]);

  useEffect(() => {
    if (uploadId === null) return;
    
    setLoading(true);
    const controller = new AbortController();
    
    apiClient.get(`/reports/snapshot?upload_id=${uploadId}`)
      .then((res) => {
        setData(res as SnapshotResponse);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        toast.error("Erro ao carregar snapshot", { description: err.message });
      })
      .finally(() => {
        setLoading(false);
      });
      
    return () => controller.abort();
  }, [uploadId, refreshTrigger]);

  return { ...data, loading, uploadId, setUploadId, refreshSnapshot };
}
