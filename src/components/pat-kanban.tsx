import { useState, useMemo } from "react";
import { StickyNote, Clock, Search } from "lucide-react";
import { PatBadge } from "./pat-badge";
import { PatInfoDrawer } from "./pat-info-drawer";
import type { ClassifiedPat } from "@/lib/pat-types";
import { getAllNotes } from "@/lib/notes-store";
import { formatDateBR } from "@/lib/excel-utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function PatKanban({ pats, onUpdate }: { pats: ClassifiedPat[]; onUpdate?: () => void }) {
  const [selected, setSelected] = useState<ClassifiedPat | null>(null);
  const [search, setSearch] = useState("");
  const notes = useMemo(() => getAllNotes(), [selected]);

  // Group PATs by status
  const columns = useMemo(() => {
    const groups: Record<string, ClassifiedPat[]> = {};
    const filteredPats = pats.filter(p => p.id.includes(search));
    
    filteredPats.forEach((p) => {
      if (p.categories.includes("encerrado")) return;
      const cur = p.recent || p.previous;
      if (!cur) return;
      const status = cur.status || "Sem Status";
      if (!groups[status]) groups[status] = [];
      groups[status].push(p);
    });

    // Ordenar as chaves de forma lógica (idealmente teríamos uma ordem fixa de status)
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [pats, search]);

  if (pats.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground border rounded-md">
        Nenhum PAT encontrado para exibir no Kanban.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2 w-full max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número do PAT..."
            className="pl-8 bg-muted/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="w-full h-[650px] border rounded-md bg-muted/20">
        <ScrollArea className="w-full h-full whitespace-nowrap rounded-md">
          <div className="flex w-max space-x-4 p-4 h-[630px] items-start">
            {columns.map(([status, groupPats]) => (
            <div key={status} className="w-80 shrink-0 flex flex-col h-full">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="font-semibold text-sm truncate uppercase tracking-wider">{status}</h3>
                <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                  {groupPats.length}
                </span>
              </div>
              
              <ScrollArea className="flex-1 rounded-md bg-muted/40 p-2 border shadow-inner">
                <div className="space-y-3 flex flex-col pb-4">
                  {groupPats.map((p) => {
                    const cur = p.recent || p.previous;
                    const hasNote = !!notes[p.id]?.text;
                    const dias = p.dias_aberto ?? null;
                    const rowAccent = p.categories.includes("atrasado")
                      ? "border-l-4 border-l-destructive"
                      : p.categories.includes("vencendo_semana")
                      ? "border-l-4 border-l-warning"
                      : p.categories.includes("postergado")
                      ? "border-l-4 border-l-purple-500"
                      : p.categories.includes("novo")
                      ? "border-l-4 border-l-success"
                      : "border-l-4 border-l-transparent";

                    return (
                      <Card
                        key={p.id}
                        className={`cursor-pointer p-3 hover:border-primary/50 transition-colors shadow-sm ${rowAccent} flex flex-col gap-2 whitespace-normal`}
                        onClick={() => setSelected(p)}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-mono text-xs font-bold text-primary">{p.id}</span>
                          <div className="flex items-center gap-1">
                            {hasNote && <StickyNote className="h-3 w-3 text-warning" />}
                            {dias !== null && (
                              <span className={`text-[10px] flex items-center gap-1 ${dias > 90 ? (dias > 180 ? 'text-destructive font-bold' : 'text-warning font-semibold') : 'text-muted-foreground'}`}>
                                <Clock className="h-3 w-3" /> {dias}d
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm font-medium leading-tight line-clamp-2" title={cur?.titulo}>
                          {cur?.titulo || "Sem título"}
                        </div>
                        
                        <div className="text-xs text-muted-foreground truncate">
                          {cur?.cliente || "Sem responsável"}
                        </div>

                        <div className="flex items-center justify-between mt-1 pt-2 border-t">
                          <div className="text-[10px] text-muted-foreground">
                            {formatDateBR(cur?.prazo) || "Sem prazo"}
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                             {p.categories.filter(c => c !== "sem_alteracao").slice(0,2).map(c => <PatBadge key={c} category={c} />)}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

        <PatInfoDrawer pat={selected} open={!!selected} onClose={() => setSelected(null)} onUpdate={onUpdate} />
      </div>
    </div>
  );
}
