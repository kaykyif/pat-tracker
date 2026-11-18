import type { AnalysisResult } from "./pat-types";

const ANALYSES_KEY = "backlog_pats_analyses_v1";
const SETTINGS_KEY = "backlog_pats_settings_v1";

export type StoredAnalysis = {
  id: string;
  name: string;
  fileName: string;
  createdAt: string;
  result: AnalysisResult;
};

export type Settings = {
  staleDays: number;
  closedStatuses: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 14,
  closedStatuses: ["Encerrado", "Concluído", "Fechado", "Cancelado", "Resolvido"],
};

export function loadAnalyses(): StoredAnalysis[] {
  try {
    return JSON.parse(localStorage.getItem(ANALYSES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveAnalysis(a: StoredAnalysis) {
  const all = loadAnalyses();
  all.unshift(a);
  localStorage.setItem(ANALYSES_KEY, JSON.stringify(all.slice(0, 50)));
}

export function deleteAnalysis(id: string) {
  const all = loadAnalyses().filter((a) => a.id !== id);
  localStorage.setItem(ANALYSES_KEY, JSON.stringify(all));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}