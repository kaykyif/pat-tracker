import * as XLSX from "xlsx";
import {
  FIXED_COLUMNS,
  FIXED_HEADERS,
  HEADER_ROW_INDEX,
  DATA_START_ROW_INDEX,
  type ColumnMapping,
  type PatField,
  type PatRow,
} from "./pat-types";

export type SheetInfo = {
  name: string;
  rowCount: number;
  columns: string[];
  preview: Record<string, unknown>[];
};

export function readWorkbook(file: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(file, { type: "array", cellDates: true });
}

export function summarizeSheets(wb: XLSX.WorkBook): SheetInfo[] {
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false });
    const header = (aoa[HEADER_ROW_INDEX] || []).map((h) => String(h ?? "").trim());
    const dataRows = aoa.slice(DATA_START_ROW_INDEX).filter((r) => r.some((c) => c !== "" && c != null));
    const preview = dataRows.slice(0, 5).map((r) => {
      const obj: Record<string, unknown> = {};
      header.forEach((h, i) => (obj[h || `col_${i}`] = r[i]));
      return obj;
    });
    return { name, rowCount: dataRows.length, columns: header, preview };
  });
}

/**
 * Lê uma sheet com layout fixo: linha 3 = cabeçalhos, linha 4+ = dados.
 * Mapeia colunas por posição usando FIXED_COLUMNS — independente do nome do header.
 */
export function sheetToFixedRows(wb: XLSX.WorkBook, sheetName: string): PatRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  // raw:true preserva Date objects (com cellDates:true). Convertendo manualmente abaixo
  // para evitar problemas de timezone em datas serializadas.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true, blankrows: false });
  const headerRow = (aoa[HEADER_ROW_INDEX] || []).map((h) => String(h ?? "").trim());
  const dataRows = aoa.slice(DATA_START_ROW_INDEX);
  const out: PatRow[] = [];
  for (const r of dataRows) {
    if (!r || !r.some((c) => c !== "" && c != null)) continue;
    const row: PatRow = { _raw: {} };
    FIXED_COLUMNS.forEach((field, i) => {
      const v = r[i];
      row._raw[headerRow[i] || FIXED_HEADERS[i] || field] = v;
      let s = "";
      if (v == null) s = "";
      else if (v instanceof Date) {
        // Preserva como ISO YYYY-MM-DD usando componentes UTC (SheetJS gera Date em UTC).
        const dd = String(v.getUTCDate()).padStart(2, "0");
        const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
        s = `${v.getUTCFullYear()}-${mm}-${dd}`;
      } else if (typeof v === "string") s = v.trim();
      else s = String(v);
      if (s) row[field] = s;
    });
    if (row.id) out.push(row);
  }
  return out;
}

/** Valida se os cabeçalhos da linha 3 batem (ao menos parcialmente) com o layout esperado. */
export function validateFixedHeaders(wb: XLSX.WorkBook, sheetName: string): { ok: boolean; found: string[]; mismatches: { index: number; expected: string; found: string }[] } {
  const ws = wb.Sheets[sheetName];
  if (!ws) return { ok: false, found: [], mismatches: [] };
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, blankrows: false });
  const headerRow = (aoa[HEADER_ROW_INDEX] || []).map((h) => String(h ?? "").trim());
  const mismatches: { index: number; expected: string; found: string }[] = [];
  FIXED_HEADERS.forEach((expected, i) => {
    const found = headerRow[i] || "";
    const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    if (n(found) !== n(expected)) mismatches.push({ index: i, expected, found });
  });
  return { ok: mismatches.length <= 2, found: headerRow, mismatches };
}

/**
 * Extrai a data do nome de uma sheet nos formatos aceitos:
 *  DD-MM-AAAA, DD_MM_AAAA, DD.MM.AAAA, DD/MM/AAAA, AAAA-MM-DD, AAAAMMDD.
 * Retorna Date em UTC ou null quando não consegue identificar.
 */
export function extractDateFromName(name: string): Date | null {
  if (!name) return null;
  const n = String(name).trim();
  // 1) YYYY-MM-DD / YYYY_MM_DD / YYYY.MM.DD / YYYY/MM/DD
  let m = n.match(/(?<![\d])(\d{4})[-_./](\d{1,2})[-_./](\d{1,2})(?![\d])/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // 2) DD-MM-YYYY / DD_MM_YYYY / DD.MM.YYYY / DD/MM/YYYY
  m = n.match(/(?<![\d])(\d{1,2})[-_./](\d{1,2})[-_./](\d{4})(?![\d])/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (!isNaN(d.getTime())) return d;
  }
  // 3) AAAAMMDD (8 dígitos contíguos)
  m = n.match(/(?<![\d])(\d{8})(?![\d])/);
  if (m) {
    const s = m[1];
    const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export type SheetDateInfo = { name: string; date: Date | null };

/**
 * Identifica a sheet da consulta atual (maior data) e a anterior
 * (segunda maior data) a partir dos nomes das sheets. Empates ou
 * ausência de datas resultam em ambiguous=true, cabendo escolha manual.
 */
export function detectByMaxDate(sheets: SheetInfo[]): {
  recent?: string;
  previous?: string;
  ambiguous: boolean;
  reason?: string;
  dated: SheetDateInfo[];
} {
  const dated: SheetDateInfo[] = sheets.map((s) => ({ name: s.name, date: extractDateFromName(s.name) }));
  const withDate = dated.filter((x) => x.date) as { name: string; date: Date }[];
  if (withDate.length < 2) {
    return { ambiguous: true, reason: "Menos de duas sheets com data reconhecível no nome.", dated };
  }
  withDate.sort((a, b) => b.date.getTime() - a.date.getTime());
  if (withDate[0].date.getTime() === withDate[1].date.getTime()) {
    return { ambiguous: true, reason: "Duas sheets com a mesma data no nome.", dated };
  }
  return { recent: withDate[0].name, previous: withDate[1].name, ambiguous: false, dated };
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Retorna o mapeamento fixo (campo → nome do header esperado). Usado por exportações e demo data. */
export function getFixedMapping(): ColumnMapping {
  const m: ColumnMapping = {};
  FIXED_COLUMNS.forEach((f, i) => (m[f] = FIXED_HEADERS[i]));
  return m;
}

export function applyMapping(rows: Record<string, unknown>[], mapping: ColumnMapping): PatRow[] {
  return rows.map((r) => {
    const out: PatRow = { _raw: r };
    (Object.keys(mapping) as PatField[]).forEach((field) => {
      const col = mapping[field];
      if (col && r[col] !== undefined && r[col] !== null) {
        const v = r[col];
        out[field] = typeof v === "string" ? v.trim() : String(v);
      }
    });
    return out;
  });
}

export function parseDateValue(v: string | undefined): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // ISO YYYY-MM-DD — construído em UTC para evitar shift de timezone.
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) {
    const d = new Date(Date.UTC(+isoM[1], +isoM[2] - 1, +isoM[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // DD/MM/YYYY ou DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback — pode ser uma string Date.toString() ou ISO completa.
  const fb = new Date(s);
  return isNaN(fb.getTime()) ? null : fb;
}

/** Formata um valor de data (string em vários formatos) como DD/MM/YYYY.
 * Usa componentes UTC para evitar shift de timezone. */
export function formatDateBR(v: string | undefined | null): string {
  if (v == null || v === "") return "";
  const d = parseDateValue(String(v));
  if (!d) return String(v);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}