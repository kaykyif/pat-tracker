// Parser para a coluna "PRAZOS" — extrai uma lista de datas históricas
// para construir uma timeline de prazos do PAT.

export type PrazoEntry = {
  date: Date;
  label: string; // texto cru ao redor da data
  raw: string;
};

const DATE_RE = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;

export function parsePrazos(value: string | undefined | null): PrazoEntry[] {
  if (!value) return [];
  const text = String(value);
  const entries: PrazoEntry[] = [];
  const lines = text.split(/[\n;|]+/).map((l) => l.trim()).filter(Boolean);

  const handleChunk = (chunk: string) => {
    const re = new RegExp(DATE_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      const d = +m[1];
      const mo = +m[2];
      const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      const date = new Date(y, mo - 1, d);
      if (isNaN(date.getTime())) continue;
      const start = Math.max(0, m.index - 30);
      const end = Math.min(chunk.length, m.index + m[0].length + 30);
      const label = chunk.slice(start, end).replace(/\s+/g, " ").trim();
      entries.push({ date, label, raw: m[0] });
    }
  };

  if (lines.length > 0) lines.forEach(handleChunk);
  else handleChunk(text);

  // dedupe por data + ordena cronologicamente
  const seen = new Set<string>();
  return entries
    .filter((e) => {
      const k = e.date.toISOString().slice(0, 10);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}