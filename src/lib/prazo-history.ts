import { loadAnalyses } from "./local-store";
import { formatDateBR, parseDateValue } from "./excel-utils";

export type PrazoHistoryEntry = {
  analysisId: string;
  analysisName: string;
  consultedAt: string; // ISO
  sheet: string; // sheetRecent name
  prazo: string | null;
  status: string | null;
  prazoBR: string;
  changed: boolean; // mudou em relação à entrada anterior
};

/**
 * Reconstrói a linha do tempo do PAT olhando todas as análises salvas,
 * ordenadas da mais antiga para a mais recente. Cada entrada captura
 * o "Prazo Externo" e status observados naquela consulta.
 */
export function buildPrazoHistory(patId: string): PrazoHistoryEntry[] {
  const all = loadAnalyses();
  const sorted = [...all].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const entries: PrazoHistoryEntry[] = [];
  for (const a of sorted) {
    const found = a.result.pats.find((p) => p.id === patId);
    if (!found || !found.recent) continue;
    const prazo = found.recent.prazo ?? null;
    const status = found.recent.status ?? null;
    const last = entries[entries.length - 1];
    const changed =
      !last ||
      (parseDateValue(prazo ?? undefined)?.getTime() ?? -1) !==
        (parseDateValue(last.prazo ?? undefined)?.getTime() ?? -1);
    entries.push({
      analysisId: a.id,
      analysisName: a.name,
      consultedAt: a.createdAt,
      sheet: a.result.sheetRecent,
      prazo,
      status,
      prazoBR: formatDateBR(prazo ?? ""),
      changed,
    });
  }
  return entries;
}