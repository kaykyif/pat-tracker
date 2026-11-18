import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FilePlus2, FileSpreadsheet, CalendarDays, ClipboardList, Users, AlertTriangle, Calendar, FileText, Loader2, UploadCloud } from "lucide-react";
import { useAnalysis } from "@/hooks/use-analysis";
import { useSnapshot } from "@/hooks/use-snapshot";
import { PatTable } from "@/components/pat-table";
import { exportElementToPdf } from "@/lib/export-pdf";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/excel-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { snapshotToClassified } from "@/lib/snapshot-to-classified";
import { apiClient } from "@/lib/api-client";
import { PatKanban } from "@/components/pat-kanban";
import { PageHeader } from "@/components/page-header";

function Kpi({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: number | string; tone?: "default" | "danger" | "warning" | "success" | "info" }) {
  const toneCls = {
    default: "bg-primary/10 text-primary",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
  }[tone];
  return (
    <Card className="shadow-[var(--shadow-sm)]">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PatsInfoGerais() {
  const { uploads } = useAnalysis();
  const { pats, upload, loading, uploadId, setUploadId, refreshSnapshot } = useSnapshot();
  const nav = useNavigate();
  const pdfRef = useRef<HTMLDivElement>(null);

  const classifiedPats = useMemo(() => {
    if (!pats || !upload) return [];
    return snapshotToClassified(pats, upload.reference_date);
  }, [pats, upload]);

  const kpis = useMemo(() => {
    let comPrazo = 0;
    let semPrazo = 0;
    let mxm = 0;
    let ativos = 0;
    
    classifiedPats.forEach(p => {
      if (p.categories.includes("encerrado")) return;
      
      ativos++;
      if (p.categories.includes("sem_prazo")) semPrazo++;
      else comPrazo++;
      
      if (p.categories.includes("aberto_mxm")) mxm++;
    });
    
    return {
      total: ativos,
      comPrazo,
      semPrazo,
      mxm
    };
  }, [classifiedPats]);

  const handleExportLevantamento = async () => {
    if (!uploadId) return;
    try {
      toast.loading("Gerando Levantamento...", { id: "export-lev" });
      await apiClient.download(`/reports/levantamento/export?upload_id=${uploadId}`, `levantamento-${upload?.reference_date}.xlsx`);
      toast.success("Download iniciado", { id: "export-lev" });
    } catch (e: any) {
      toast.error("Erro ao exportar levantamento", { id: "export-lev", description: e.message });
    }
  };

  const handleExportGerencial = async () => {
    if (!uploadId) return;
    try {
      toast.loading("Gerando Gerencial...", { id: "export-ger" });
      await apiClient.download(`/reports/gerencial/export?upload_id=${uploadId}`, `gerencial-${upload?.reference_date}.xlsx`);
      toast.success("Download iniciado", { id: "export-ger" });
    } catch (e: any) {
      toast.error("Erro ao exportar gerencial", { id: "export-ger", description: e.message });
    }
  };

  const handleExportPdf = async () => {
    if (!pdfRef.current) return;
    try {
      toast.loading("Gerando PDF...", { id: "pdf" });
      await exportElementToPdf(pdfRef.current, `pats-${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF gerado", { id: "pdf" });
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { id: "pdf", description: e.message });
    }
  };

  const handleImportLevantamento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading("Importando dados...", { id: "import" });
      const res = await apiClient.post("/reports/manual-data/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`${res.updated} registros atualizados!`, { id: "import" });
      // Força um reload para pegar os novos snapshots atualizados se estiverem carregados
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      toast.error("Erro na importação", { id: "import", description: error.message });
    } finally {
      e.target.value = "";
    }
  };

  if (uploads.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center h-[50vh]">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <CardTitle>Nenhum dado disponível</CardTitle>
            <CardDescription>Faça upload de um relatório da MXM para visualizar os PATs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <Button onClick={() => nav("/nova-analise")}><FilePlus2 className="mr-2 h-4 w-4" /> Novo Upload</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="PATs - Informações Gerais" description="Base de dados completa de todos os PATs e levantamentos">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Base de dados:</span>
          <Select value={String(uploadId)} onValueChange={v => setUploadId(Number(v))}>
            <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {uploads.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {formatDateBR(u.reference_date)} ({u.total_pats} PATs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <Tabs defaultValue="pats" className="w-full">
        <TabsList>
          <TabsTrigger value="pats">Lista (Tabela)</TabsTrigger>
          <TabsTrigger value="kanban">Quadro (Kanban)</TabsTrigger>
          <TabsTrigger value="export">Exportar Relatórios</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-6 h-[700px]">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PatKanban pats={classifiedPats} onUpdate={refreshSnapshot} />
          )}
        </TabsContent>

        <TabsContent value="pats" className="mt-6 space-y-6">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div ref={pdfRef} className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi icon={ClipboardList} label="Total PATs" value={kpis.total} />
                <Kpi icon={CalendarDays} label="Com Prazo" value={kpis.comPrazo} tone="success" />
                <Kpi icon={Calendar} label="Sem Prazo" value={kpis.semPrazo} tone="warning" />
                <Kpi icon={Users} label="PATs MXM" value={kpis.mxm} tone="info" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lista de PATs</CardTitle>
                  <CardDescription>
                    Baseado no relatório de {upload ? formatDateBR(upload.reference_date) : ""}. 
                    Clique em qualquer linha para preencher o levantamento e ver o histórico.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PatTable pats={classifiedPats} onUpdate={refreshSnapshot} />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="export" className="mt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Levantamento de PATs
                </CardTitle>
                <CardDescription>Gera o relatório com o layout de Levantamento completo, incluindo dados manuais.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={handleExportLevantamento} disabled={loading || !uploadId}>
                  <Download className="mr-2 h-4 w-4" /> Gerar Excel (.xlsx)
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-primary" />
                  Importar Levantamento
                </CardTitle>
                <CardDescription>
                  Faça upload de uma planilha de Levantamento anterior para preencher automaticamente os responsáveis e andamentos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleImportLevantamento}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Selecione um arquivo .xlsx"
                  />
                  <Button className="w-full pointer-events-none" variant="default">
                    <UploadCloud className="mr-2 h-4 w-4" /> Importar Arquivo (.xlsx)
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-success" />
                  Relatório Gerencial
                </CardTitle>
                <CardDescription>Gera o relatório com o layout de Diretoria (Base WK e Resumo).</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" onClick={handleExportGerencial} disabled={loading || !uploadId}>
                  <Download className="mr-2 h-4 w-4" /> Gerar Excel (.xlsx)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-destructive" />
                  Exportar PDF
                </CardTitle>
                <CardDescription>Gera um PDF com a visão atual da aba "PATs" (KPIs e tabela visualizada).</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" onClick={() => {
                  document.querySelector('[data-state="inactive"][value="pats"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                  setTimeout(handleExportPdf, 500);
                }} disabled={loading || !uploadId}>
                  <Download className="mr-2 h-4 w-4" /> Exportar PDF
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
