import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";

export default function NewAnalysis() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setBusy(true);
    setStatus(`Enviando ${f.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", f);
      
      const res = await apiClient.post("/uploads", formData);
      toast.success("Upload concluído!", { description: `${res.total_mxm ?? 0} PATs MXM salvos para ${res.reference_date}.` });
      nav("/");
    } catch (e: any) {
      toast.error("Erro no upload", { description: e.message });
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Upload de Dados" description="Substitua ou adicione a mais recente extração de PATs da MXM." />

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Arquivo esperado</AlertTitle>
        <AlertDescription className="text-xs">
          O arquivo deve conter apenas 1 aba (sheet), com a data na célula A2 no formato "Emitido em: DD/MM/YYYY"
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-8">
          <div
            onClick={() => !busy && fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (busy) return; const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/30 p-12 text-center transition ${busy ? "opacity-60" : "cursor-pointer border-border hover:border-primary hover:bg-accent/50"}`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium">{busy ? status || "Enviando..." : "Arraste o arquivo Excel aqui ou clique para selecionar"}</p>
              <p className="text-sm text-muted-foreground">.xls, .xlsx (Exportação direta da MXM)</p>
            </div>
            <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-8">
          <div
            onClick={() => !busy && document.getElementById('encerrados-upload')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { 
              e.preventDefault(); 
              if (busy) return; 
              const f = e.dataTransfer.files?.[0]; 
              if (f) {
                setBusy(true);
                setStatus(`Enviando Encerrados: ${f.name}...`);
                const formData = new FormData();
                formData.append("file", f);
                apiClient.post("/uploads/encerrados", formData)
                  .then(res => {
                    toast.success("PATs Encerrados importados!", { description: `${res.inserted} inseridos, ${res.updated} atualizados.` });
                  })
                  .catch(err => {
                    toast.error("Erro no upload", { description: err.message });
                  })
                  .finally(() => {
                    setBusy(false);
                    setStatus("");
                  });
              } 
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/30 p-12 text-center transition ${busy ? "opacity-60" : "cursor-pointer border-border hover:border-primary hover:bg-accent/50"}`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium">{busy ? status || "Enviando..." : "Importar Histórico de PATs Encerrados"}</p>
              <p className="text-sm text-muted-foreground">Arraste a planilha de fechamentos da MXM aqui (.xls, .xlsx)</p>
            </div>
            <input 
              id="encerrados-upload" 
              type="file" 
              accept=".xlsx,.xls" 
              className="hidden" 
              onChange={(e) => { 
                const f = e.target.files?.[0]; 
                if (f) {
                  setBusy(true);
                  setStatus(`Enviando Encerrados: ${f.name}...`);
                  const formData = new FormData();
                  formData.append("file", f);
                  apiClient.post("/uploads/encerrados", formData)
                    .then(res => {
                      toast.success("PATs Encerrados importados!", { description: `${res.inserted} inseridos, ${res.updated} atualizados.` });
                    })
                    .catch(err => {
                      toast.error("Erro no upload", { description: err.message });
                    })
                    .finally(() => {
                      setBusy(false);
                      setStatus("");
                    });
                }
              }} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
