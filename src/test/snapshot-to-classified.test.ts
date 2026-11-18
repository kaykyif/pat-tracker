import { describe, it, expect } from "vitest";
import { snapshotToClassified } from "../lib/snapshot-to-classified";
import type { PatRow } from "../lib/pat-types";

// Datas distantes no futuro para que os cenários de prazo não dependam da data
// real de execução do teste ("atrasado" na visão snapshot usa "hoje" real).
const REFERENCE = "2035-06-21"; // semana de referência: 24/06 a 30/06/2035
const IN_WEEK = "2035-06-26";
const PAST = "2020-01-01";
const AFTER_WEEK = "2035-12-01";

function pat(overrides: Partial<PatRow> & { id: string }): PatRow {
  return { _raw: {}, aberto_com: "MXM", ...overrides };
}

function patWithManual(overrides: Partial<PatRow> & { id: string }, manualData: Record<string, string>): PatRow {
  const p = pat(overrides) as PatRow & { manual_data?: Record<string, string> };
  p.manual_data = manualData;
  return p;
}

describe("snapshotToClassified — Infos Gerais / Quadro Gerencial", () => {
  it("recorte MXM normalizado (case-insensitive) na visão snapshot", () => {
    const [p] = snapshotToClassified([pat({ id: "P1", aberto_com: "mxm", prazo: AFTER_WEEK })], REFERENCE);
    expect(p.categories).toContain("aberto_mxm");
  });

  it("atrasado é medido contra a data real de hoje", () => {
    const [p] = snapshotToClassified([pat({ id: "P2", prazo: PAST })], REFERENCE);
    expect(p.categories).toContain("atrasado");
  });

  it("vencendo_semana dentro da semana de referência", () => {
    const [p] = snapshotToClassified([pat({ id: "P3", prazo: IN_WEEK })], REFERENCE);
    expect(p.categories).toContain("vencendo_semana");
    expect(p.categories).not.toContain("atrasado");
  });

  it("sem_prazo quando não há prazo informado", () => {
    const [p] = snapshotToClassified([pat({ id: "P4" })], REFERENCE);
    expect(p.categories).toContain("sem_prazo");
  });

  it("prazo após a semana de referência não recebe categoria de prazo", () => {
    const [p] = snapshotToClassified([pat({ id: "P11", prazo: AFTER_WEEK })], REFERENCE);
    expect(p.categories).not.toContain("atrasado");
    expect(p.categories).not.toContain("vencendo_semana");
    expect(p.categories).not.toContain("sem_prazo");
  });

  it("postergado considera a trajetória completa (historico_prazos)", () => {
    const [p] = snapshotToClassified(
      [pat({ id: "P5", prazo: IN_WEEK, historico_prazos: ["2034-01-10", "2035-01-10", "2035-06-26"] })],
      REFERENCE,
    );
    expect(p.categories).toContain("postergado");
    expect(p.prazo_anterior).toBe("2035-01-10");
  });

  it("encerrado sobrepõe atrasado/vencendo/sem prazo", () => {
    const [p] = snapshotToClassified([pat({ id: "P6", prazo: PAST, is_closed_historic: true })], REFERENCE);
    expect(p.categories).toContain("encerrado");
    expect(p.categories).not.toContain("atrasado");
    expect(p.categories).not.toContain("vencendo_semana");
    expect(p.categories).not.toContain("sem_prazo");
  });

  it("encerrado não recebe vencendo_semana mesmo com prazo na semana", () => {
    const [p] = snapshotToClassified([pat({ id: "P7", prazo: IN_WEEK, is_closed_historic: true })], REFERENCE);
    expect(p.categories).toContain("encerrado");
    expect(p.categories).not.toContain("vencendo_semana");
  });

  it("sem_levantamento é indicador separado e não suprime categorias de prazo", () => {
    const [p] = snapshotToClassified([pat({ id: "P8", prazo: PAST })], REFERENCE);
    expect(p.categories).toContain("sem_levantamento");
    expect(p.categories).toContain("atrasado");
  });

  it("sem_levantamento permanece indicado quando encerrado sobrepõe o prazo", () => {
    const [p] = snapshotToClassified([pat({ id: "P9", prazo: PAST, is_closed_historic: true })], REFERENCE);
    expect(p.categories).toContain("encerrado");
    expect(p.categories).toContain("sem_levantamento");
  });

  it("não marca sem_levantamento quando há dados manuais preenchidos", () => {
    const p10 = patWithManual(
      { id: "P10", prazo: AFTER_WEEK },
      {
        andamento: "Em análise",
        responsavel_pat: "",
        usuario_solicitante: "",
        gerente: "",
        diretor: "",
        cliente_impactado: "",
        impacto_problema: "",
        medida_contorno: "",
      },
    );
    const [p] = snapshotToClassified([p10], REFERENCE);
    expect(p.categories).not.toContain("sem_levantamento");
  });
});
