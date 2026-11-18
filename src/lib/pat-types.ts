export const PAT_FIELDS = [
  "id",
  "modulo",
  "titulo",
  "cliente",
  "data_abertura",
  "prioridade",
  "status",
  "tipo_prazo",
  "descricao",
  "prazo",
  "encerramento",
  "aberto_com",
  "responsavel",
  "ultima_atualizacao",
  "impacto",
  "observacoes",
] as const;

export type PatField = (typeof PAT_FIELDS)[number];

export const PAT_FIELD_LABELS: Record<PatField, string> = {
  id: "PAT",
  modulo: "Sistema",
  titulo: "Função",
  cliente: "Responsável",
  data_abertura: "Abertura",
  prioridade: "Natureza",
  status: "Status",
  tipo_prazo: "Tipo de Prazo",
  descricao: "Descrição",
  prazo: "Prazo Externo",
  encerramento: "Encerramento",
  aberto_com: "Aberto Com",
  responsavel: "Responsável",
  ultima_atualizacao: "Última Atualização",
  impacto: "Impacto",
  observacoes: "Observações",
};

export const PAT_FIELD_REQUIRED: PatField[] = ["id"];

/**
 * Layout fixo da planilha: linha 3 = cabeçalhos, linha 4+ = dados.
 * A ordem das colunas é a posição na planilha (A, B, C, ...).
 */
export const FIXED_COLUMNS: PatField[] = [
  "id",            // A — PAT
  "modulo",        // B — Sistema
  "titulo",        // C — Função
  "cliente",       // D — Usuário
  "data_abertura", // E — Abertura
  "prioridade",    // F — Natureza
  "status",        // G — Status
  "tipo_prazo",    // H — Tipo de Prazo
  "descricao",     // I — Descrição
  "prazo",         // J — Prazo Externo
  "encerramento",  // K — Encerramento
  "aberto_com",    // L — Aberto Com
];

export const FIXED_HEADERS = [
  "PAT",
  "Sistema",
  "Função",
  "Usuário",
  "Abertura",
  "Natureza",
  "Status",
  "Tipo de Prazo",
  "Descrição",
  "Prazo Externo",
  "Encerramento",
  "Aberto Com",
];

export const HEADER_ROW_INDEX = 2; // 0-based → linha 3 da planilha
export const DATA_START_ROW_INDEX = 3; // 0-based → linha 4 da planilha

export type PatRow = {
  _raw: Record<string, unknown>;
  historico_prazos?: string[];
  is_closed_historic?: boolean;
  is_override_encerramento?: boolean;
  is_override_status?: boolean;
} & Partial<Record<PatField, string>>;

export type ColumnMapping = Partial<Record<PatField, string>>;

export type PatCategory =
  | "novo"
  | "removido"
  | "saiu_mxm"
  | "alterado"
  | "sem_alteracao"
  | "atrasado"
  | "vencendo_semana"
  | "postergado"
  | "sem_prazo"
  | "sem_atualizacao"
  | "aberto_mxm"
  | "sem_levantamento"
  | "encerrado";

export type PatChange = {
  id: string;
  field: PatField;
  before: string | null;
  after: string | null;
};

export type ClassifiedPat = {
  id: string;
  recent?: PatRow;
  previous?: PatRow;
  categories: PatCategory[];
  changes: PatChange[];
  prazo_anterior?: string | null;
  dias_aberto?: number | null;
  manual_data?: Record<string, string>;
};

export type AnalysisResult = {
  pats: ClassifiedPat[];
  totals: Record<string, number>;
  totalRecent: number;
  totalPrevious: number;
  mapping: ColumnMapping;
  sheetRecent: string;
  sheetPrevious: string;
  /** ISO YYYY-MM-DD data da consulta atual (extraída do nome da sheet) */
  dateRecent?: string | null;
  datePrevious?: string | null;
  /** Semana de referência: domingo a sábado da SEMANA SEGUINTE à data da consulta atual */
  weekStart?: string | null;
  weekEnd?: string | null;
  /** Contagem no recorte MXM (Aberto Com = MXM) */
  mxmRecent?: number;
  mxmPrevious?: number;
  /** Log de validação — mensagens de inconsistência detectadas */
  validationLog?: string[];
};