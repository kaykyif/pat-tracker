import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { type AnalysisResult, type ClassifiedPat, type PatCategory, PAT_FIELDS, PAT_FIELD_LABELS, type PatField } from "./pat-types";
import { formatDateBR, parseDateValue } from "./excel-utils";
import { buildPrazoHistory } from "./prazo-history";

const DATE_FIELDS: PatField[] = ["data_abertura", "prazo", "encerramento", "ultima_atualizacao"];
function fmt(field: PatField, value: unknown): string {
  if (value == null || value === "") return "";
  if (DATE_FIELDS.includes(field)) return formatDateBR(String(value));
  return String(value);
}

const CATEGORY_COLORS: Record<string, string> = {
  novo: "FF22C55E",
  alterado: "FF3B82F6",
  atrasado: "FFEF4444",
  vencendo_semana: "FFF59E0B",
  postergado: "FFA855F7",
  sem_prazo: "FF6B7280",
  removido: "FF94A3B8",
  aberto_mxm: "FF0EA5E9",
};

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.border = { bottom: { style: "thin", color: { argb: "FF1E40AF" } } };
}

function autoFit(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value ? String(cell.value) : "";
      if (v.length > max) max = Math.min(60, v.length + 2);
    });
    col.width = max;
  });
}

function addPatSheet(wb: ExcelJS.Workbook, name: string, pats: ClassifiedPat[], useRecent = true, colorCategory?: PatCategory, includePrevDeadline = false) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const baseHeaders = ["ID", ...PAT_FIELDS.filter((f) => f !== "id").map((f) => PAT_FIELD_LABELS[f])];
  const headers = includePrevDeadline ? [...baseHeaders, "Prazo Anterior", "Categorias"] : [...baseHeaders, "Categorias"];
  ws.addRow(headers);
  ws.getRow(1).eachCell(headerStyle);

  pats.forEach((p) => {
    const source = useRecent ? p.recent : p.previous;
    if (!source) return;
    const base = [p.id, ...PAT_FIELDS.filter((f) => f !== "id").map((f) => fmt(f, source[f]))];
    const row = includePrevDeadline ? [...base, formatDateBR(p.prazo_anterior || ""), p.categories.join(", ")] : [...base, p.categories.join(", ")];
    const added = ws.addRow(row);
    if (colorCategory) {
      added.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CATEGORY_COLORS[colorCategory] + "20" } };
      });
    }
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  autoFit(ws);
}

export async function exportAnalysisToExcel(result: AnalysisResult, fileName = "backlog-pats.xlsx") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Backlog PATs";
  wb.created = new Date();

  // 1) Dashboard — indicadores principais
  const dash = wb.addWorksheet("Dashboard");
  dash.addRow(["Indicador", "Valor"]);
  dash.getRow(1).eachCell(headerStyle);
  const rowsDash: [string, number | string][] = [
    ["Sheet atual", result.sheetRecent],
    ["Sheet anterior", result.sheetPrevious],
    ["Data consulta atual", result.dateRecent ? formatDateBR(result.dateRecent) : "—"],
    ["Data consulta anterior", result.datePrevious ? formatDateBR(result.datePrevious) : "—"],
    ["Semana de referência", result.weekStart && result.weekEnd ? `${formatDateBR(result.weekStart)} a ${formatDateBR(result.weekEnd)}` : "—"],
    ["Total de PATs (consulta atual)", result.totalRecent],
    ["Total de PATs (consulta anterior)", result.totalPrevious],
    ["Total MXM atual", result.mxmRecent ?? 0],
    ["Total MXM anterior", result.mxmPrevious ?? 0],
    ["Novos PATs MXM", result.totals.novo || 0],
    ["Saíram do recorte MXM", result.totals.saiu_mxm || 0],
    ["Alterados", result.totals.alterado || 0],
    ["Prazo para a semana", result.totals.vencendo_semana || 0],
    ["Postergados", result.totals.postergado || 0],
    ["Atrasados", result.totals.atrasado || 0],
    ["Sem prazo", result.totals.sem_prazo || 0],
  ];
  rowsDash.forEach((r) => dash.addRow(r));
  autoFit(dash);

  // 2) PRAZO PARA A SEMANA — reaproveita o exportador Formatado embutido
  const semana = result.pats.filter((p) => p.categories.includes("vencendo_semana"));
  const postergados = result.pats.filter((p) => p.categories.includes("postergado"));
  const atrasados = result.pats.filter((p) => p.categories.includes("atrasado"));
  const semPrazo = result.pats.filter((p) => p.categories.includes("sem_prazo"));
  const wsSemana = wb.addWorksheet("PRAZO PARA A SEMANA");
  const widths = [10, 28, 32, 22, 12, 12, 22, 60, 12, 14, 60];
  widths.forEach((w, i) => (wsSemana.getColumn(i + 1).width = w));
  addSection(wsSemana, "PATS COM PRAZO PRA SEMANA", semana);
  addSection(wsSemana, "PATS COM PRAZO POSTERGADO", postergados, true);
  addSection(wsSemana, "PATs em atraso", atrasados);
  addSection(wsSemana, "PATs sem prazo", semPrazo);

  // 3) Comparativo
  const comp = wb.addWorksheet("Comparativo", { views: [{ state: "frozen", ySplit: 1 }] });
  comp.addRow(["PAT", "Categoria", "Sistema", "Função", "Usuário", "Status Atual", "Prazo Atual", "Status Anterior", "Prazo Anterior", "Aberto Com Atual", "Aberto Com Anterior", "Observação"]);
  comp.getRow(1).eachCell(headerStyle);
  result.pats.forEach((p) => {
    const r = p.recent, pr = p.previous;
    const cats = p.categories.filter((c) => c !== "sem_alteracao").join(", ");
    const obs = p.categories.includes("postergado")
      ? `Prazo postergado (era ${formatDateBR(p.prazo_anterior || "")})`
      : p.categories.includes("novo")
      ? "Novo no recorte MXM"
      : p.categories.includes("saiu_mxm")
      ? "Saiu do recorte MXM"
      : "";
    comp.addRow([
      p.id, cats,
      r?.modulo || pr?.modulo || "",
      r?.titulo || pr?.titulo || "",
      r?.cliente || pr?.cliente || "",
      r?.status || "", formatDateBR(r?.prazo || ""),
      pr?.status || "", formatDateBR(pr?.prazo || ""),
      r?.aberto_com || "", pr?.aberto_com || "",
      obs,
    ]);
  });
  comp.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };
  autoFit(comp);

  // 4) Alteracoes
  const alt = wb.addWorksheet("Alteracoes", { views: [{ state: "frozen", ySplit: 1 }] });
  alt.addRow(["PAT", "Campo alterado", "Valor anterior", "Valor atual"]);
  alt.getRow(1).eachCell(headerStyle);
  result.pats.forEach((p) => {
    p.changes.forEach((ch) => {
      const label = PAT_FIELD_LABELS[ch.field as PatField] || ch.field;
      const before = DATE_FIELDS.includes(ch.field as PatField) ? formatDateBR(ch.before || "") : ch.before;
      const after = DATE_FIELDS.includes(ch.field as PatField) ? formatDateBR(ch.after || "") : ch.after;
      alt.addRow([p.id, label, before, after]);
    });
  });
  alt.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  autoFit(alt);

  // 5) Novos
  addPatSheet(wb, "Novos", result.pats.filter((p) => p.categories.includes("novo")), true, "novo");
  // 6) Sairam_Recorte_MXM
  addPatSheet(wb, "Sairam_Recorte_MXM", result.pats.filter((p) => p.categories.includes("saiu_mxm")), false);

  // 7) INFO
  const info = wb.addWorksheet("INFO");
  info.columns = [{ width: 32 }, { width: 60 }];
  const infoRows: [string, string | number][] = [
    ["Arquivo importado", result.sheetRecent + " / " + result.sheetPrevious],
    ["Sheet atual usada", result.sheetRecent],
    ["Sheet anterior usada", result.sheetPrevious],
    ["Data/hora da geração", new Date().toLocaleString("pt-BR")],
    ["Regra da semana usada", result.weekStart && result.weekEnd ? `Domingo a sábado da semana seguinte à consulta atual — ${formatDateBR(result.weekStart)} a ${formatDateBR(result.weekEnd)}` : "—"],
    ["Filtro aplicado", "Aberto Com = MXM"],
    ["Total lido — sheet atual", result.totalRecent],
    ["Total lido — sheet anterior", result.totalPrevious],
    ["Total no recorte MXM — atual", result.mxmRecent ?? 0],
    ["Total no recorte MXM — anterior", result.mxmPrevious ?? 0],
  ];
  infoRows.forEach(([k, v]) => {
    const r = info.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}

/* ------------------------------------------------------------------ */
/* Exportação no padrão "Formatado" usado pela equipe (Backlog MXM)    */
/* ------------------------------------------------------------------ */

const FORMATADO_HEADERS = [
  "PAT",
  "Sistema",
  "Função",
  "Usuário",
  "Abertura",
  "Natureza",
  "Status",
  "Descrição",
  "Prazo",
  "Aberto Com",
  "PRAZOS",
] as const;

const FORMATADO_FIELDS: (PatField | "PRAZOS")[] = [
  "id",
  "modulo",
  "titulo",
  "cliente",
  "data_abertura",
  "prioridade",
  "status",
  "descricao",
  "prazo",
  "aberto_com",
  "PRAZOS",
];

const FORMATADO_DATE_COLS = new Set([5, 9]); // 1-based: Abertura, Prazo

function isMxm(p: ClassifiedPat): boolean {
  const v = (p.recent?.aberto_com || "").toUpperCase();
  return v.includes("MXM");
}

function fmtSemanaRange(today = new Date()): string {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const offsetToMonday = (dow + 6) % 7;
  const start = new Date(d); start.setDate(d.getDate() - offsetToMonday);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const f = (x: Date) => `${String(x.getDate()).padStart(2, "0")}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  return `${f(start)} a ${f(end)}`;
}

function prazosAnterioresString(patId: string, currentPrazo: string | undefined): string {
  const history = buildPrazoHistory(patId);
  const seen = new Set<number>();
  const out: string[] = [];
  const curT = parseDateValue(currentPrazo)?.getTime();
  for (const h of history) {
    const d = parseDateValue(h.prazo ?? undefined);
    if (!d) continue;
    const t = d.getTime();
    if (t === curT) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(formatDateBR(h.prazo ?? ""));
  }
  if (out.length === 0) return "";
  return `PRAZOS ANTERIORES ${out.join("; ")}`;
}

/** Cores das seções conforme o modelo enviado pela equipe. */
const SECTION_COLORS: Record<string, string | null> = {
  "PATS COM PRAZO PRA SEMANA": "FF92D050",     // verde
  "PATS COM PRAZO POSTERGADO": "FFFFFF00",     // amarelo
  "PATs em atraso": "FFFFC000",                // laranja
  "PATs sem prazo": null,                       // sem preenchimento
};

function addSectionHeader(ws: ExcelJS.Worksheet, title: string) {
  const row = ws.addRow([title]);
  const c = row.getCell(1);
  c.value = title;
  c.font = { bold: true, color: { argb: "FF000000" } };
  const color = SECTION_COLORS[title];
  if (color) {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  }
  c.alignment = { vertical: "middle", horizontal: "left" };
}

function addColumnHeaders(ws: ExcelJS.Worksheet) {
  const row = ws.addRow([...FORMATADO_HEADERS]);
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FF000000" } };
    c.alignment = { vertical: "middle", horizontal: "left" };
  });
}

function addPatRow(ws: ExcelJS.Worksheet, p: ClassifiedPat, includePrazos: boolean) {
  const src = p.recent;
  if (!src) return;
  const values: unknown[] = FORMATADO_FIELDS.map((f) => {
    if (f === "PRAZOS") return includePrazos ? prazosAnterioresString(p.id, src.prazo) : "";
    const v = src[f as PatField];
    if (f === "data_abertura" || f === "prazo") {
      const d = parseDateValue(v as string | undefined);
      return d ?? "";
    }
    if (f === "id") {
      const n = Number(v);
      return Number.isFinite(n) && String(n) === String(v).trim() ? n : (v ?? "");
    }
    return v ?? "";
  });
  const row = ws.addRow(values);
  row.alignment = { vertical: "top", wrapText: false };
  FORMATADO_DATE_COLS.forEach((idx) => {
    const c = row.getCell(idx);
    if (c.value instanceof Date) c.numFmt = "dd/mm/yyyy";
  });
}

function addSection(ws: ExcelJS.Worksheet, title: string, pats: ClassifiedPat[], includePrazos = false) {
  addSectionHeader(ws, title);
  addColumnHeaders(ws);
  pats.forEach((p) => addPatRow(ws, p, includePrazos));
  ws.addRow([]);
}

export async function exportFormatadoToExcel(result: AnalysisResult, fileName?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Backlog MXM";
  wb.created = new Date();

  const ws = wb.addWorksheet("PRAZO PARA A SEMANA");
  // Column widths aproximadas ao modelo
  const widths = [10, 28, 32, 22, 12, 12, 22, 60, 12, 14, 60];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const mxm = result.pats.filter(isMxm);

  const semana = mxm.filter((p) => p.categories.includes("vencendo_semana"));
  const postergados = mxm.filter((p) => p.categories.includes("postergado"));
  const atrasados = mxm.filter((p) => p.categories.includes("atrasado"));
  const semPrazo = mxm.filter((p) => p.categories.includes("sem_prazo"));

  addSection(ws, "PATS COM PRAZO PRA SEMANA", semana);
  addSection(ws, "PATS COM PRAZO POSTERGADO", postergados, true);
  addSection(ws, "PATs em atraso", atrasados);
  addSection(ws, "PATs sem prazo", semPrazo);

  // Sheet INFO
  const info = wb.addWorksheet("INFO");
  info.columns = [{ width: 24 }, { width: 60 }];
  const rows: [string, string][] = [
    ["Arquivo atual", result.sheetRecent],
    ["Arquivo anterior", result.sheetPrevious],
    ["Semana considerada", fmtSemanaRange()],
    ["Regra coluna Aberto Com", "Somente Aberto Com = MXM"],
    ["Regra início", "Dados lidos a partir da linha 4 da Consulta de PAT"],
    ["Regra coluna Prazo", "Prazo lido da coluna J / Prazo Externo"],
    ["Regra postergado", "Mantém postergados quando o prazo atual é maior que o anterior"],
    ["Modelo de formatação", "Backlog MXM - Prazos (Formatado)"],
  ];
  rows.forEach(([k, v]) => {
    const r = info.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  });

  const name = fileName || `Backlog MXM - Prazos ${fmtSemanaRange()} - Formatado.xlsx`;
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
}