import { usePatHistory } from "@/hooks/use-pat-history";
import { Calendar, ArrowRight, Loader2, MessageSquare, Activity, User, FileText } from "lucide-react";
import { formatDateBR } from "@/lib/excel-utils";

export function PatHistoryTimeline({ patId }: { patId: string }) {
  const { history, loading } = usePatHistory(patId);

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Não foi possível carregar o histórico deste PAT.
      </div>
    );
  }

  // To find previous snapshot to compare prazo/natureza changes
  const groupedHistory: any[] = [];
  let lastGroupedSnap: any = null;

  for (const e of history) {
    if (e.type === "snapshot") {
      if (lastGroupedSnap) {
        const prazoMudou = e.prazo !== lastGroupedSnap.prazo;
        const naturezaMudou = e.natureza !== lastGroupedSnap.natureza;
        const statusMudou = e.status !== lastGroupedSnap.status;
        const abertoMudou = e.aberto_com !== lastGroupedSnap.aberto_com;
        
        const hasChanges = prazoMudou || naturezaMudou || statusMudou || abertoMudou;
        
        if (!hasChanges && !lastGroupedSnap.hasChanges) {
          lastGroupedSnap.dates.push(e.date);
          continue;
        }
      }
      
      const newSnap = { 
        ...e, 
        dates: [e.date], 
        prevPrazo: lastGroupedSnap?.prazo, 
        prevNatureza: lastGroupedSnap?.natureza,
        hasChanges: lastGroupedSnap ? (
          e.prazo !== lastGroupedSnap.prazo ||
          e.natureza !== lastGroupedSnap.natureza ||
          e.status !== lastGroupedSnap.status ||
          e.aberto_com !== lastGroupedSnap.aberto_com
        ) : false
      };
      groupedHistory.push(newSnap);
      lastGroupedSnap = newSnap;
    } else {
      groupedHistory.push(e);
    }
  }

  return (
    <div className="rounded-md border bg-card p-3 max-h-[500px] overflow-y-auto">
      <ol className="relative space-y-5 border-l-2 border-border pl-4 ml-2">
        {groupedHistory.map((e: any, i: number) => {
          if (e.type === "snapshot") {
            const prazoMudou = e.prevPrazo !== undefined && e.prazo !== e.prevPrazo;
            const naturezaMudou = e.prevNatureza !== undefined && e.natureza !== e.prevNatureza;
            const changed = prazoMudou || naturezaMudou;
            
            const datesStr = e.dates.map((d: string) => formatDateBR(d) || "Data Desconhecida").join(", ");

            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[21px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background ${
                    changed ? "bg-warning" : "bg-primary"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">
                    Atualização MXM - {datesStr}
                  </span>
                  {changed && <span className="text-[10px] font-semibold text-warning">Alterações Detectadas</span>}
                </div>
                <div className="mt-2 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium w-16">Prazo:</span>
                    {prazoMudou ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through">
                          {formatDateBR(e.prevPrazo) || "S/ Prazo"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="rounded bg-success/10 px-1.5 py-0.5 font-medium text-success">
                          {formatDateBR(e.prazo) || "S/ Prazo"}
                        </span>
                      </div>
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {formatDateBR(e.prazo) || "S/ Prazo"}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium w-16">Natureza:</span>
                    {naturezaMudou ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through">
                          {e.prevNatureza || "Outros"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="rounded bg-success/10 px-1.5 py-0.5 font-medium text-success">
                          {e.natureza || "Outros"}
                        </span>
                      </div>
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {e.natureza || "Outros"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {e.status && <span className="text-muted-foreground">· Status: {e.status}</span>}
                    {e.aberto_com && <span className="text-muted-foreground">· Aberto com: {e.aberto_com}</span>}
                  </div>
                </div>
              </li>
            );
          } else if (e.type === "manual") {
            const hasAndamento = e.andamento && e.andamento.trim().length > 0;
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background bg-blue-500" />
                
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Anotação Manual (Levantamento) - {formatDateBR(e.date) || "Data Desconhecida"}
                  </span>
                </div>
                
                <div className="mt-2 text-xs space-y-2">
                  {hasAndamento ? (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                      <div className="flex items-center gap-1.5 mb-1 text-blue-700 dark:text-blue-300 font-medium">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Andamento / Reavaliação:
                      </div>
                      <div className="text-muted-foreground whitespace-pre-wrap">
                        {e.andamento}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic bg-muted/30 p-2 rounded-md">
                      Nenhum andamento preenchido neste levantamento.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground pt-1">
                    {e.responsavel_pat && <div><span className="font-medium">Responsável:</span> {e.responsavel_pat}</div>}
                    {e.usuario_solicitante && <div><span className="font-medium">Solicitante:</span> {e.usuario_solicitante}</div>}
                    {e.gerente && <div><span className="font-medium">Gerente:</span> {e.gerente}</div>}
                  </div>
                </div>
              </li>
            );
          } else if (e.type === "encerrado") {
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background bg-success" />
                
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Activity className="h-3.5 w-3.5 text-success" />
                  <span className="font-medium text-success">
                    PAT Encerrado - {formatDateBR(e.date) || "Data Desconhecida"}
                  </span>
                </div>
                
                <div className="mt-2 text-xs space-y-2">
                  <div className="bg-success/10 p-2.5 rounded-md border border-success/30">
                    <div className="text-success font-medium">
                      Este PAT foi marcado como encerrado pela MXM.
                    </div>
                  </div>
                </div>
              </li>
            );
          }
          return null;
        })}
      </ol>
    </div>
  );
}
