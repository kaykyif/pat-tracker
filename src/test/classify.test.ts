import { describe, it, expect } from "vitest";
import { classify, getNextSunToSatWeek } from "../lib/classify";
import { parseDateValue } from "../lib/excel-utils";
import type { ColumnMapping, PatRow } from "../lib/pat-types";

const SHEET_RECENT = "Consulta 2026-06-19";
const SHEET_PREVIOUS = "Consulta 2026-06-12";
const MAPPING: ColumnMapping = {};
const CONFIG = { staleDays: 14, closedStatuses: [] };

// Semana de referência calculada pela própria regra (domingo a sábado da semana
// seguinte à consulta recente) — evita depender do dia da semana na data fixa.
const reference = parseDateValue("2026-06-19")!;
const week = getNextSunToSatWeek(reference);

function isoOffset(days: number): string {
  const d = new Date(
    Date.UTC(week.start.getUTCFullYear(), week.start.getUTCMonth(), week.start.getUTCDate() + days),
  );
  return d.toISOString().slice(0, 10);
}

/** Prazo dentro da semana de referência (vencendo_semana). */
const IN_WEEK = isoOffset(2);
/** Prazo anterior ao domingo da semana de referência (atrasado). */
const BEFORE_WEEK = isoOffset(-5);
/** Prazo após o sábado da semana de referência (sem categoria de prazo). */
const AFTER_WEEK = isoOffset(9);

function mxm(overrides: Partial<PatRow> & { id: string }): PatRow {
  return { _raw: {}, aberto_com: "MXM", ...overrides };
}

describe("classify — Backlog Semanal", () => {
  it("novo: PAT presente apenas no upload recente", () => {
    const res = classify([mxm({ id: "PAT-1", prazo: AFTER_WEEK })], [], MAPPING, SHEET_RECENT, SHEET_PREVIOUS, CONFIG);
    expect(res.pats).toHaveLength(1);
    expect(res.pats[0].categories).toContain("novo");
  });

  it("saiu_mxm: PAT presente no anterior e ausente no recente", () => {
    const res = classify([], [mxm({ id: "PAT-2", prazo: AFTER_WEEK })], MAPPING, SHEET_RECENT, SHEET_PREVIOUS, CONFIG);
    expect(res.pats[0].categories).toContain("saiu_mxm");
  });

  it("alterado: campo relevante mudou entre os snapshots", () => {
    const res = classify(
      [mxm({ id: "PAT-3", status: "Em Andamento", prazo: AFTER_WEEK })],
      [mxm({ id: "PAT-3", status: "Aberto", prazo: AFTER_WEEK })],
      MAPPING,
      SHEET_RECENT,
      SHEET_PREVIOUS,
      CONFIG,
    );
    const pat = res.pats[0];
    expect(pat.categories).toContain("alterado");
    expect(
      pat.changes.some((c) => c.field === "status" && c.before === "Aberto" && c.after === "Em Andamento"),
    ).toBe(true);
  });

  it("atrasado: prazo anterior ao domingo da semana de referência", () => {
    const res = classify([mxm({ id: "PAT-4", prazo: BEFORE_WEEK })], [], MAPPING, SHEET_RECENT, SHEET_PREVIOUS, CONFIG);
    expect(res.pats[0].categories).toContain("atrasado");
  });

  it("vencendo_semana: prazo dentro da semana de referência", () => {
    const res = classify([mxm({ id: "PAT-5", prazo: IN_WEEK })], [], MAPPING, SHEET_RECENT, SHEET_PREVIOUS, CONFIG);
    expect(res.pats[0].categories).toContain("vencendo_semana");
  });

  it("postergado: prazo recente posterior ao anterior (comparação entre snapshots)", () => {
    const res = classify(
      [mxm({ id: "PAT-6", prazo: AFTER_WEEK })],
      [mxm({ id: "PAT-6", prazo: BEFORE_WEEK })],
      MAPPING,
      SHEET_RECENT,
      SHEET_PREVIOUS,
      CONFIG,
    );
    const pat = res.pats[0];
    expect(pat.categories).toContain("postergado");
    expect(pat.prazo_anterior).toBe(BEFORE_WEEK);
  });

  it("sem_prazo: PAT aberto sem prazo informado", () => {
    const res = classify([mxm({ id: "PAT-7" })], [], MAPPING, SHEET_RECENT, SHEET_PREVIOUS, CONFIG);
    expect(res.pats[0].categories).toContain("sem_prazo");
  });

  it("sem_atualizacao: última referência (encerramento) mais antiga que staleDays", () => {
    const res = classify(
      [mxm({ id: "PAT-8", prazo: AFTER_WEEK, encerramento: "2025-01-01" })],
      [],
      MAPPING,
      SHEET_RECENT,
      SHEET_PREVIOUS,
      CONFIG,
    );
    expect(res.pats[0].categories).toContain("sem_atualizacao");
  });

  it("recorte MXM é case-insensitive também no backlog", () => {
    const res = classify(
      [mxm({ id: "PAT-9", aberto_com: "mxm", prazo: AFTER_WEEK })],
      [mxm({ id: "PAT-9", aberto_com: "mxm", prazo: AFTER_WEEK })],
      MAPPING,
      SHEET_RECENT,
      SHEET_PREVIOUS,
      CONFIG,
    );
    expect(res.pats[0].categories).toContain("aberto_mxm");
    expect(res.pats[0].categories).toContain("sem_alteracao");
  });
});
