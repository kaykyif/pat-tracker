import { useMemo } from "react";
import { Calendar, ArrowRight } from "lucide-react";
import { buildPrazoHistory } from "@/lib/prazo-history";
import { format } from "date-fns";

export function PrazoHistory({ patId }: { patId: string }) {
  const entries = useMemo(() => buildPrazoHistory(patId), [patId]);

  if (entries.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Ainda não há histórico de consultas para este PAT. Conforme novas
        planilhas forem importadas, o "Prazo Externo" observado em cada consulta
        aparecerá aqui.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <ol className="relative space-y-3 border-l-2 border-border pl-4">
        {entries.map((e, i) => {
          const prev = entries[i - 1];
          return (
            <li key={e.analysisId} className="relative">
              <span
                className={`absolute -left-[21px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background ${
                  e.changed && i > 0 ? "bg-warning" : "bg-primary"
                }`}
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {format(new Date(e.consultedAt), "dd/MM/yyyy HH:mm")}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {e.analysisName}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Prazo:</span>
                {e.changed && i > 0 && prev?.prazoBR ? (
                  <>
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through">
                      {prev.prazoBR || "—"}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="rounded bg-success/10 px-1.5 py-0.5 font-medium text-success">
                      {e.prazoBR || "—"}
                    </span>
                  </>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {e.prazoBR || "—"}
                  </span>
                )}
                {e.status && (
                  <span className="text-muted-foreground">· {e.status}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}