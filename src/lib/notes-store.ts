// Anotações por PAT, persistidas em localStorage e mantidas entre análises.
const KEY = "backlog_pats_notes_v1";

type NotesMap = Record<string, { text: string; updatedAt: string }>;

function read(): NotesMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getNote(patId: string): string {
  return read()[patId]?.text || "";
}

export function setNote(patId: string, text: string) {
  const all = read();
  if (!text.trim()) delete all[patId];
  else all[patId] = { text, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getAllNotes(): NotesMap {
  return read();
}