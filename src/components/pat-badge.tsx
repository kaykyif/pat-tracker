import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PatCategory } from "@/lib/pat-types";

const STYLES: Record<PatCategory, { label: string; className: string }> = {
  novo: { label: "Novo", className: "bg-success/15 text-success border-success/30" },
  alterado: { label: "Alterado", className: "bg-info/15 text-info border-info/30" },
  atrasado: { label: "Atrasado", className: "bg-destructive/15 text-destructive border-destructive/30" },
  vencendo_semana: { label: "Vence na semana", className: "bg-warning/15 text-warning border-warning/30" },
  postergado: { label: "Postergado", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  sem_prazo: { label: "Sem prazo", className: "bg-muted text-muted-foreground border-border" },
  sem_atualizacao: { label: "Sem atualização", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  aberto_mxm: { label: "MXM", className: "bg-primary/15 text-primary border-primary/30" },
  sem_alteracao: { label: "Sem alteração", className: "bg-muted text-muted-foreground border-border" },
  removido: { label: "Removido", className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
  saiu_mxm: { label: "Saiu do recorte MXM", className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};

export function PatBadge({ category }: { category: PatCategory }) {
  const s = STYLES[category];
  if (!s) return null;
  return <Badge variant="outline" className={cn("font-medium", s.className)}>{s.label}</Badge>;
}