import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";

export type PatManualData = {
  andamento: string;
  responsavel_pat: string;
  usuario_solicitante: string;
  gerente: string;
  diretor: string;
  cliente_impactado: string;
  impacto_problema: string;
  medida_contorno: string;
};

const defaultData: PatManualData = {
  andamento: "",
  responsavel_pat: "",
  usuario_solicitante: "",
  gerente: "",
  diretor: "",
  cliente_impactado: "",
  impacto_problema: "",
  medida_contorno: "",
};

export function PatManualForm({ patId, initialData }: { patId: string; initialData?: Partial<PatManualData> }) {
  const [data, setData] = useState<PatManualData>({ ...defaultData, ...initialData });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);

  const debouncedData = useDebounce(data, 1000);

  useEffect(() => {
    setData({ ...defaultData, ...initialData });
    setIsDirty(false);
    setSaveStatus("idle");
  }, [patId, initialData]);

  const handleSave = async (dataToSave: PatManualData) => {
    setSaveStatus("saving");
    try {
      await apiClient.put(`/reports/manual-data/${patId}`, dataToSave);
      setSaveStatus("saved");
      setIsDirty(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e: any) {
      setSaveStatus("error");
    }
  };

  useEffect(() => {
    if (isDirty) {
      handleSave(debouncedData);
    }
  }, [debouncedData]);

  const handleChange = (field: keyof PatManualData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const Field = ({ id, label, isTextarea = false, placeholder = "" }: { id: keyof PatManualData, label: string, isTextarea?: boolean, placeholder?: string }) => {
    const value = data[id];
    const isEmpty = !value || value.trim() === "";
    
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
          {isEmpty && (
            <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning" title="Campo não preenchido">
              <AlertCircle className="h-3 w-3" /> Pendente
            </span>
          )}
        </div>
        {isTextarea ? (
          <Textarea
            id={id}
            value={value}
            onChange={(e) => handleChange(id, e.target.value)}
            placeholder={placeholder || `Preencha o ${label.toLowerCase()}...`}
            rows={3}
            className={isEmpty ? "border-warning/30 focus-visible:ring-warning/50" : ""}
          />
        ) : (
          <Input
            id={id}
            value={value}
            onChange={(e) => handleChange(id, e.target.value)}
            placeholder={placeholder || `Preencha o ${label.toLowerCase()}...`}
            className={isEmpty ? "border-warning/30 focus-visible:ring-warning/50" : ""}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-sm font-semibold">Dados de Levantamento</h3>
        <div className="flex items-center text-xs text-muted-foreground h-8">
          {saveStatus === "saving" && <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Salvando...</>}
          {saveStatus === "saved" && <><CheckCircle2 className="mr-1.5 h-3 w-3 text-success" /> Salvo</>}
          {saveStatus === "error" && <><AlertCircle className="mr-1.5 h-3 w-3 text-destructive" /> Erro ao salvar</>}
          {saveStatus === "idle" && isDirty && <span className="italic">Digitando...</span>}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field id="andamento" label="Andamento" isTextarea />
        <Field id="impacto_problema" label="Impacto do Problema" isTextarea />
        <Field id="medida_contorno" label="Medida de Contorno" isTextarea />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="responsavel_pat" label="Responsável (PAT)" />
        <Field id="usuario_solicitante" label="Usuário Solicitante" />
        <Field id="gerente" label="Gerente" />
        <Field id="diretor" label="Diretor" />
        <Field id="cliente_impactado" label="Cliente Impactado" />
      </div>
    </div>
  );
}
