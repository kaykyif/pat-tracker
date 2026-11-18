import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatBadge } from "./pat-badge";
import { PAT_FIELD_LABELS, type ClassifiedPat, type PatField } from "@/lib/pat-types";
import { Clock } from "lucide-react";
import { PatHistoryTimeline } from "./pat-history-timeline";
import { PatNotes } from "./pat-notes";
import { PatManualForm } from "./pat-manual-form";
import { PrazosTimeline } from "./prazos-timeline";
import { formatDateBR } from "@/lib/excel-utils";
import { ArrowRight, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAnalysis } from "@/hooks/use-analysis";

export function PatInfoDrawer({ pat, open, onClose, onUpdate }: { pat: ClassifiedPat | null; open: boolean; onClose: () => void; onUpdate?: () => void }) {
  const queryClient = useQueryClient();
  const { refreshBacklog } = useAnalysis();
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [editData, setEditData] = useState({ encerramento: "", status: "" });
  const [isSaving, setIsSaving] = useState(false);

  if (!pat) return null;
  const cur = pat.recent || pat.previous;

  const startEdit = () => {
    setEditData({
      encerramento: cur?.encerramento ? cur.encerramento.substring(0, 10) : "",
      status: cur?.status || ""
    });
    setIsEditingBase(true);
  };

  const cancelEdit = () => {
    setIsEditingBase(false);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      // Fetch current manual data to not overwrite it
      const currentManualRes = await apiClient.get(`/reports/manual-data/${pat.id}`);
      
      const payload = {
        ...(currentManualRes || {}),
        override_encerramento: editData.encerramento || null,
        override_status: editData.status || null,
      };

      await apiClient.put(`/reports/manual-data/${pat.id}`, payload);
      toast.success("Dados atualizados com sucesso");
      setIsEditingBase(false);
      queryClient.invalidateQueries({ queryKey: ["analysis"] });
      queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      refreshBacklog();
      if (onUpdate) onUpdate();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="mb-4 border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-base">{pat.id}</span>
            {pat.dias_aberto != null && (
              <span
                className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  pat.categories.includes("encerrado")
                    ? "bg-muted text-muted-foreground"
                    : pat.dias_aberto > 180
                    ? "bg-destructive/10 text-destructive"
                    : pat.dias_aberto > 90
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Clock className="h-3 w-3" />
                {pat.categories.includes("encerrado")
                  ? `Fechado com ${pat.dias_aberto} dias`
                  : `${pat.dias_aberto} dias em aberto`}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>{cur?.titulo || "Sem título"}</SheetDescription>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {pat.categories.map((c) => <PatBadge key={c} category={c} />)}
            {pat.categories.includes("encerrado") && cur?.encerramento && (
              <span className="flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                Encerrado em {formatDateBR(cur.encerramento)}
              </span>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="hist" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="hist">Histórico</TabsTrigger>
            <TabsTrigger value="data">Dados Base</TabsTrigger>
            <TabsTrigger value="manual">Levantamento</TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hist" className="mt-4 space-y-4">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Linha do tempo do PAT (Prazo Externo)</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Histórico consolidado com base nas consultas realizadas no sistema.
              </p>
              <PatHistoryTimeline patId={pat.id} />
            </section>
            
            {cur?.observacoes && (
              <section className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Prazos extraídos da planilha</h3>
                <PrazosTimeline value={cur?.observacoes} />
              </section>
            )}
          </TabsContent>
          
          <TabsContent value="data" className="mt-4">
            {pat.categories.includes("postergado") && pat.prazo_anterior && (
              <section className="mb-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Postergação detectada</h3>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Prazo anterior:</span>
                  <span className="rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive line-through">{formatDateBR(pat.prazo_anterior)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Novo prazo:</span>
                  <span className="rounded bg-success/10 px-2 py-0.5 font-medium text-success">{formatDateBR(cur?.prazo) || "—"}</span>
                </div>
              </section>
            )}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Dados extraídos da MXM</h3>
                {!isEditingBase && (
                  <Button variant="outline" size="sm" onClick={startEdit} className="h-7 text-xs">
                    <Pencil className="mr-1.5 h-3 w-3" /> Editar
                  </Button>
                )}
              </div>
              
              {isEditingBase ? (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Data de Encerramento (Override)</label>
                    <Input 
                      type="date" 
                      value={editData.encerramento} 
                      onChange={e => setEditData(prev => ({ ...prev, encerramento: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Status (Override)</label>
                    <Input 
                      type="text" 
                      value={editData.status} 
                      onChange={e => setEditData(prev => ({ ...prev, status: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" onClick={saveEdit} disabled={isSaving} className="h-7">
                      <Check className="mr-1.5 h-3 w-3" /> Gravar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving} className="h-7">
                      <X className="mr-1.5 h-3 w-3" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-2 text-sm">
                  {(Object.keys(PAT_FIELD_LABELS) as PatField[]).filter((f) => f !== "id" && cur?.[f]).map((f) => (
                    <div key={f} className="grid grid-cols-3 gap-2 border-b py-1.5">
                      <dt className="text-muted-foreground">{PAT_FIELD_LABELS[f]}</dt>
                      <dd className="col-span-2 break-words flex items-center gap-2">
                        {fmtFieldValue(f, cur?.[f])}
                        {f === "encerramento" && cur?.is_override_encerramento && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Editado Manualmente</span>
                        )}
                        {f === "status" && cur?.is_override_status && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Editado Manualmente</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <PatManualForm patId={pat.id} initialData={(cur as any)?.manual_data} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <PatNotes patId={pat.id} />
          </TabsContent>
        </Tabs>
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
