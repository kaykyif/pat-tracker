import { parsePrazos } from "@/lib/prazos-parser";
import { Calendar } from "lucide-react";

export function PrazosTimeline({ value }: { value: string | undefined | null }) {
  const entries = parsePrazos(value);
  if (entries.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Nenhum prazo histórico identificado na coluna PRAZOS.
        {value ? <div className="mt-2 whitespace-pre-wrap text-xs">{value}</div> : null}
      </div>
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="rounded-md border bg-card p-3">
      <ol className="relative space-y-3 border-l-2 border-border pl-4">
        {entries.map((e, i) => {
          const past = e.date.getTime() < today.getTime();
          return (
            <li key={i} className="relative">
              <span
                className={`absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background ${
                  past ? "bg-muted-foreground" : "bg-primary"
                }`}
              />
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {e.date.toLocaleDateString("pt-BR")}
                {past && <span className="text-xs text-muted-foreground">(passado)</span>}
              </div>
              <div className="text-xs text-muted-foreground">{e.label}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}