import { describe, it, expect } from "vitest";
import { classifyDeadline } from "../lib/deadline-classifier";

// Janela de referência genérica (domingo a sábado): 2026-06-21 a 2026-06-27.
// "hoje real" (Infos Gerais): 2026-06-19 (sexta-feira).
const weekStart = new Date(Date.UTC(2026, 5, 21));
const weekEnd = new Date(Date.UTC(2026, 5, 27));
const reference = new Date(Date.UTC(2026, 5, 19));

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("classifyDeadline — regra compartilhada (Backlog Semanal × Infos Gerais)", () => {
  it("sem prazo → sem_prazo", () => {
    expect(classifyDeadline(null, { weekStart, weekEnd, referenceDate: reference })).toBe("sem_prazo");
  });

  it("Backlog Semanal: atrasado medido contra o domingo da semana-alvo", () => {
    // 2026-06-20 (sábado) é posterior a hoje (19/06) mas anterior ao domingo (21/06).
    expect(classifyDeadline(date("2026-06-20"), { weekStart, weekEnd, referenceDate: reference })).toBe("atrasado");
  });

  it("Infos Gerais: o mesmo prazo não é atrasado porque é medido contra hoje real", () => {
    expect(
      classifyDeadline(date("2026-06-20"), {
        weekStart,
        weekEnd,
        referenceDate: reference,
        measureAtrasadoAgainstToday: true,
      }),
    ).toBeNull();
  });

  it("prazo na semana → vencendo_semana", () => {
    expect(classifyDeadline(date("2026-06-23"), { weekStart, weekEnd, referenceDate: reference })).toBe("vencendo_semana");
  });

  it("prazo após a semana → sem categoria de prazo (null)", () => {
    expect(classifyDeadline(date("2026-06-30"), { weekStart, weekEnd, referenceDate: reference })).toBeNull();
  });
});
