import { type ClassifiedPat, type PatCategory, type PatRow } from "./pat-types";
import { parse, isValid, isAfter, startOfDay, addDays, startOfWeek, endOfWeek } from "date-fns";
import { classifyDeadline } from "./deadline-classifier";

/** Recorte MXM normalizado (trim + upper), alinhado ao backend e ao classify.ts. */
function isMxm(v: string | null | undefined): boolean {
  return (v || "").toString().trim().toUpperCase() === "MXM";
}

export function snapshotToClassified(pats: PatRow[], referenceDateIso: string): ClassifiedPat[] {
  // Data de referência do snapshot (consulta atual).
  const refDate = parse(referenceDateIso, "yyyy-MM-dd", new Date());

  // Semana de referência: de domingo a sábado da semana SEGUINTE à referência
  // (mesma lógica do backend e do classify.ts — Backlog Semanal).
  const refMais7 = addDays(refDate, 7);
  const weekStart = startOfWeek(refMais7, { weekStartsOn: 0 }); // Domingo
  const weekEnd = endOfWeek(refMais7, { weekStartsOn: 0 });     // Sábado

  // Na visão Infos Gerais, "atrasado" é medido contra a data real de hoje.
  const today = startOfDay(new Date());

  return pats.map(p => {
    const categories: PatCategory[] = [];
    const closed = !!p.is_closed_historic || !!p.encerramento;

    // 1. Atrasado / Vencendo na semana / Sem prazo
    //    Regra de prazo compartilhada com o Backlog Semanal (deadline-classifier.ts),
    //    porém com "atrasado" medido contra hoje real nesta visão.
    //    "encerrado" sobrepõe qualquer categoria de prazo (atrasado/vencendo/sem prazo).
    if (!closed) {
      const prazoDate = p.prazo ? parse(p.prazo, "yyyy-MM-dd", new Date()) : null;
      const deadlineCategory =
        prazoDate && isValid(prazoDate)
          ? classifyDeadline(prazoDate, {
              weekStart,
              weekEnd,
              referenceDate: today,
              measureAtrasadoAgainstToday: true,
            })
          : "sem_prazo";
      if (deadlineCategory) categories.push(deadlineCategory);
    }

    // 2. Aberto com MXM — recorte normalizado (case-insensitive).
    if (isMxm(p.aberto_com)) {
      categories.push("aberto_mxm");
    }

    // 3. Encerrado (visão histórica).
    if (closed) {
      categories.push("encerrado");
    }

    // Calcular dias aberto
    let diasAberto = null;
    if (p.data_abertura) {
      const start = parse(p.data_abertura, "yyyy-MM-dd", new Date());
      if (isValid(start)) {
        const end = p.encerramento ? parse(p.encerramento, "yyyy-MM-dd", new Date()) : today;
        if (isValid(end)) {
          diasAberto = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
    }

    const patId = (p as any).pat_id || p.id || "";

    let prazoAnterior = null;
    // 4. Postergado — considera a trajetória completa (historico_prazos), e não apenas
    //    o comparativo entre dois snapshots (regra do Backlog Semanal).
    const history = p.historico_prazos || [];
    if (history.length > 1) {
      const currentPrazoStr = history[history.length - 1];
      const currentPrazo = parse(currentPrazoStr, "yyyy-MM-dd", new Date());
      if (isValid(currentPrazo)) {
        // Verifica se algum prazo anterior é estritamente menor que o atual
        for (let i = history.length - 2; i >= 0; i--) {
           const prevPrazo = parse(history[i], "yyyy-MM-dd", new Date());
           if (isValid(prevPrazo) && isAfter(currentPrazo, prevPrazo)) {
              categories.push("postergado");
              prazoAnterior = history[i];
              break;
           }
        }
      }
    }

    // 5. Levantamento manual — indicador separado, não categoria principal.
    //    É um sinal informativo: não interfere nas categorias de prazo/status e
    //    permanece presente mesmo quando "encerrado" sobrepõe as categorias de prazo.
    const manualData = (p as any).manual_data;
    if (!manualData || !Object.values(manualData).some(v => typeof v === 'string' && v.trim() !== "")) {
      categories.push("sem_levantamento");
    }

    return {
      id: patId,
      recent: p,
      categories,
      changes: [], // Sem comparativo, não há mudanças
      dias_aberto: diasAberto,
      prazo_anterior: prazoAnterior,
      manual_data: manualData
    };
  });
}
