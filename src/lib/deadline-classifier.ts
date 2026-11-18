import type { PatCategory } from "./pat-types";

export type DeadlineCategory = Extract<PatCategory, "atrasado" | "vencendo_semana" | "sem_prazo">;

export type DeadlineContext = {
  /** Domingo da semana de referência (inclusive). */
  weekStart: Date;
  /** Sábado da semana de referência (inclusive). */
  weekEnd: Date;
  /**
   * Data usada como limite de "atrasado" quando `measureAtrasadoAgainstToday`
   * é true (Infos Gerais). No Backlog Semanal não é utilizada.
   */
  referenceDate: Date;
  /**
   * true → Infos Gerais: "atrasado" é medido contra a data real de hoje.
   * false → Backlog Semanal: "atrasado" é medido contra o domingo da semana de referência.
   */
  measureAtrasadoAgainstToday?: boolean;
};

/**
 * Regra unificada de classificação de prazo — compartilhada entre o Backlog
 * Semanal (src/lib/classify.ts) e as Infos Gerais (src/lib/snapshot-to-classified.ts).
 * Espelhada no backend em `services/classifier.py::classify_deadline`.
 *
 * - Backlog Semanal: atrasado = prazo anterior ao domingo da semana-alvo;
 *   vencendo_semana = prazo dentro da semana-alvo; sem_prazo = sem prazo informado.
 * - Infos Gerais: mesma regra, porém "atrasado" é medido contra a data real de hoje.
 *
 * Retorna null quando o prazo existe mas está depois da semana de referência
 * (nenhuma categoria de prazo se aplica).
 */
export function classifyDeadline(
  deadline: Date | null | undefined,
  ctx: DeadlineContext,
): DeadlineCategory | null {
  if (!deadline) return "sem_prazo";
  const threshold = ctx.measureAtrasadoAgainstToday ? ctx.referenceDate : ctx.weekStart;
  if (deadline.getTime() < threshold.getTime()) return "atrasado";
  if (deadline.getTime() >= ctx.weekStart.getTime() && deadline.getTime() <= ctx.weekEnd.getTime()) {
    return "vencendo_semana";
  }
  return null;
}
