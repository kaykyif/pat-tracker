import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PatBadge } from "./pat-badge";
import { PAT_FIELD_LABELS, type ClassifiedPat, type PatField } from "@/lib/pat-types";
import { ArrowRight, Clock } from "lucide-react";
import { PrazosTimeline } from "./prazos-timeline";
import { PatNotes } from "./pat-notes";
import { PrazoHistory } from "./prazo-history";
import { formatDateBR } from "@/lib/excel-utils";

export function PatDetail({ pat, open, onClose }: { pat: ClassifiedPat | null; open: boolean; onClose: () => void }) {
  if (!pat) return null;
  const cur = pat.recent || pat.previous;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-base">{pat.id}</span>
            {pat.dias_aberto != null && (
              <span
                className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  pat.dias_aberto > 180
                    ? "bg-destructive/10 text-destructive"
                    : pat.dias_aberto > 90
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Clock className="h-3 w-3" />
                {pat.dias_aberto} dias em aberto
              </span>
            )}
          </SheetTitle>
          <SheetDescription>{cur?.titulo || "Sem título"}</SheetDescription>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {pat.categories.map((c) => <PatBadge key={c} category={c} />)}
          </div>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {pat.categories.includes("postergado") && pat.prazo_anterior && (
            <section className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Postergação detectada</h3>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Prazo anterior:</span>
                <span className="rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive line-through">{formatDateBR(pat.prazo_anterior)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Novo prazo:</span>
                <span className="rounded bg-success/10 px-2 py-0.5 font-medium text-success">{formatDateBR(pat.recent?.prazo) || "—"}</span>
              </div>
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Linha do tempo do PAT (Prazo Externo)</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Reconstruído a partir do histórico de consultas salvas. Pontos em
              destaque indicam mudança no prazo entre uma consulta e outra.
            </p>
            <PrazoHistory patId={pat.id} />
          </section>
          {cur?.observacoes && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Prazos registrados na própria planilha</h3>
              <PrazosTimeline value={cur?.observacoes} />
            </section>
          )}
          <section>
            <PatNotes patId={pat.id} />
          </section>
          {pat.changes.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Alterações entre as consultas</h3>
              <div className="space-y-2">
                {pat.changes.map((ch, i) => (
                  <div key={i} className="rounded-md border bg-card p-3 text-sm">
                    <div className="text-xs font-medium text-muted-foreground">{PAT_FIELD_LABELS[ch.field as PatField] || ch.field}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive line-through">{fmtFieldValue(ch.field, ch.before) || "—"}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="rounded bg-success/10 px-2 py-0.5 text-success">{fmtFieldValue(ch.field, ch.after) || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Dados atuais</h3>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              {(Object.keys(PAT_FIELD_LABELS) as PatField[]).filter((f) => f !== "id" && cur?.[f]).map((f) => (
                <div key={f} className="grid grid-cols-3 gap-2 border-b py-1.5">
                  <dt className="text-muted-foreground">{PAT_FIELD_LABELS[f]}</dt>
                  <dd className="col-span-2 break-words">{fmtFieldValue(f, cur?.[f])}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const DATE_FIELDS: PatField[] = [
  "data_abertura",
  "prazo",
  "encerramento",
  "ultima_atualizacao",
];

function fmtFieldValue(field: string, value: string | null | undefined) {
  if (value == null || value === "") return "";
  if (DATE_FIELDS.includes(field as PatField)) return formatDateBR(value);
  return value;
}