import { extractDateFromName, parseDateValue } from "./excel-utils";
import { classifyDeadline } from "./deadline-classifier";
import {
  type AnalysisResult,
  type ClassifiedPat,
  type ColumnMapping,
  type PatChange,
  type PatField,
  type PatRow,
  PAT_FIELDS,
} from "./pat-types";

// Campos considerados "relevantes" para marcar um PAT como Alterado.
// Mapeamento conceitual: Status, Natureza (prioridade), Tipo de Prazo,
// Prazo Externo (prazo), Sistema (modulo), Função (titulo),
// Usuário (cliente) e Aberto Com.
const COMPARE_FIELDS: PatField[] = [
  "status",
  "prioridade",
  "tipo_prazo",
  "prazo",
  "modulo",
  "titulo",
  "cliente",
  "aberto_com",
];

export type ClassifyConfig = {
  staleDays: number;
  closedStatuses: string[];
};

/**
 * Semana de referência: DOMINGO a SÁBADO da SEMANA SEGUINTE à data
 * informada (consulta atual). Ex.: referência = sex 19/06/2026 →
 * semana = 21/06/2026 (dom) a 27/06/2026 (sab).
 * Datas são retornadas em UTC para comparação consistente.
 */
export function getNextSunToSatWeek(reference: Date): { start: Date; end: Date } {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth();
  const d = reference.getUTCDate();
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); // Sun=0 .. Sat=6
  const add = ((7 - dow) % 7) || 7; // sempre o próximo domingo (nunca hoje)
  const start = new Date(Date.UTC(y, m, d + add));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6));
  return { start, end };
}

/** Compat: manter nome antigo para consumidores externos. */
export function getWeekRange(today = new Date()): { start: Date; end: Date } {
  return getNextSunToSatWeek(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
}

function isMxmRow(r?: PatRow | null): boolean {
  if (!r) return false;
  const v = (r.aberto_com || "").toString().trim().toUpperCase();
  return v === "MXM";
}

/** Status que devem ser ignorados em toda a análise. */
const IGNORED_STATUSES = ["aguardando direcionamento interno"];
function isIgnoredStatus(r?: PatRow | null): boolean {
  if (!r) return false;
  const s = (r.status || "").toString().trim().toLowerCase();
  return IGNORED_STATUSES.some((ig) => s.includes(ig));
}

export function classify(
  recent: PatRow[],
  previous: PatRow[],
  mapping: ColumnMapping,
  sheetRecent: string,
  sheetPrevious: string,
  config: ClassifyConfig,
): AnalysisResult {
  // Data de referência (consulta atual) — extraída do nome da sheet quando possível.
  const dateRecent = extractDateFromName(sheetRecent);
  const datePrevious = extractDateFromName(sheetPrevious);
  const referenceDate = dateRecent
    ? new Date(Date.UTC(dateRecent.getUTCFullYear(), dateRecent.getUTCMonth(), dateRecent.getUTCDate()))
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const week = getNextSunToSatWeek(referenceDate);

  // Recorte MXM (Aberto Com == "MXM")
  // Também descartamos PATs com status "Aguardando direcionamento interno".
  const recentMxm = recent.filter((r) => isMxmRow(r) && !isIgnoredStatus(r));
  const previousMxm = previous.filter((r) => isMxmRow(r) && !isIgnoredStatus(r));

  const recentMap = new Map<string, PatRow>();
  for (const p of recentMxm) if (p.id) recentMap.set(String(p.id), p);
  const previousMap = new Map<string, PatRow>();
  for (const p of previousMxm) if (p.id) previousMap.set(String(p.id), p);

  const ids = new Set([...recentMap.keys(), ...previousMap.keys()]);

  const pats: ClassifiedPat[] = [];
  for (const id of ids) {
    const r = recentMap.get(id);
    const p = previousMap.get(id);
    const categories: Set<string> = new Set();
    const changes: PatChange[] = [];

    if (r && !p) categories.add("novo");
    if (!r && p) categories.add("saiu_mxm");

    if (r && p) {
      for (const f of COMPARE_FIELDS) {
        const a = (r[f] ?? "").toString().trim();
        const b = (p[f] ?? "").toString().trim();
        if (a !== b) changes.push({ id, field: f, before: b || null, after: a || null });
      }
      if (changes.length > 0) categories.add("alterado");
      else categories.add("sem_alteracao");

      const oldDeadline = parseDateValue(p.prazo);
      const newDeadline = parseDateValue(r.prazo);
      if (oldDeadline && newDeadline && newDeadline.getTime() > oldDeadline.getTime()) {
        categories.add("postergado");
      }
    }

    if (r) {
      categories.add("aberto_mxm");
      const deadline = parseDateValue(r.prazo);
      // Regra de prazo compartilhada com a visão Infos Gerais (deadline-classifier.ts).
      // No Backlog Semanal, "atrasado" é medido contra o domingo da semana-alvo.
      const deadlineCategory = classifyDeadline(deadline, {
        weekStart: week.start,
        weekEnd: week.end,
        referenceDate,
      });
      if (deadlineCategory) categories.add(deadlineCategory);
      // "Sem atualização" — comportamento atual preservado: usa a última referência
      // disponível (ultima_atualizacao ou encerramento) e marca quando a diferença
      // em dias em relação à data da consulta ultrapassa staleDays.
      const lastUpd = parseDateValue(r.ultima_atualizacao) || parseDateValue(r.encerramento);
      if (lastUpd) {
        const diffDays = (referenceDate.getTime() - lastUpd.getTime()) / 86400000;
        if (diffDays > config.staleDays) categories.add("sem_atualizacao");
      }
    }

    const isPostponed = categories.has("postergado");
    const opened = parseDateValue(r?.data_abertura) || parseDateValue(p?.data_abertura);
    const diasAberto = opened
      ? Math.max(0, Math.floor((referenceDate.getTime() - opened.getTime()) / 86400000))
      : null;

    pats.push({
      id,
      recent: r,
      previous: p,
      categories: Array.from(categories) as ClassifiedPat["categories"],
      changes,
      prazo_anterior: isPostponed ? (p?.prazo ?? null) : null,
      dias_aberto: diasAberto,
    });
  }

  const totals: Record<string, number> = {
    total_atual: recent.length,
    total_anterior: previous.length,
    mxm_atual: recentMxm.length,
    mxm_anterior: previousMxm.length,
    novo: 0,
    saiu_mxm: 0,
    alterado: 0,
    sem_alteracao: 0,
    atrasado: 0,
    vencendo_semana: 0,
    postergado: 0,
    sem_prazo: 0,
    sem_atualizacao: 0,
    aberto_mxm: 0,
  };
  for (const p of pats) for (const c of p.categories) totals[c] = (totals[c] || 0) + 1;

  void mapping; void PAT_FIELDS;
  return {
    pats,
    totals,
    totalRecent: recent.length,
    totalPrevious: previous.length,
    mxmRecent: recentMxm.length,
    mxmPrevious: previousMxm.length,
    mapping,
    sheetRecent,
    sheetPrevious,
    dateRecent: dateRecent ? dateRecent.toISOString().slice(0, 10) : null,
    datePrevious: datePrevious ? datePrevious.toISOString().slice(0, 10) : null,
    weekStart: week.start.toISOString().slice(0, 10),
    weekEnd: week.end.toISOString().slice(0, 10),
    validationLog: [],
  };
}

export function findDuplicates(rows: PatRow[]): string[] {
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (!r.id) continue;
    seen.set(r.id, (seen.get(r.id) || 0) + 1);
  }
  return Array.from(seen.entries()).filter(([, c]) => c > 1).map(([id]) => id);
}