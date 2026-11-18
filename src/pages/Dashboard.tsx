import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FilePlus2, FileSpreadsheet, AlertTriangle, Calendar, Sparkles, RefreshCw, Clock, FileText, LogOut, Users, ClipboardList, CalendarDays, Loader2 } from "lucide-react";
import { useAnalysis } from "@/hooks/use-analysis";
import { PatTable } from "@/components/pat-table";
import { exportElementToPdf } from "@/lib/export-pdf";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/excel-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { DashboardCharts } from "@/components/dashboard-charts";
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

export default function Dashboard() {
  const { currentResult: current, uploads, recentId, previousId, setRecentId, setPreviousId, loading } = useAnalysis();
  const nav = useNavigate();
  const pdfRef = useRef<HTMLDivElement>(null);

  const pats = current?.pats ?? [];
  const summary = useMemo(() => buildSummary(current), [current]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  if (uploads.length < 2) {
    return (
      <div className="flex flex-1 items-center justify-center h-[50vh]">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <CardTitle>Dados insuficientes</CardTitle>
            <CardDescription>Faça upload de pelo menos 2 relatórios da MXM para gerar o comparativo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <Button onClick={() => nav("/nova-analise")}><FilePlus2 className="mr-2 h-4 w-4" /> Novo Upload</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!current) return null;

  const { totals, totalRecent, sheetRecent, sheetPrevious, mxmRecent, mxmPrevious, weekStart, weekEnd, validationLog } = current;

  const handleExport = async () => {
    if (!recentId || !previousId) return;
    try {
      toast.loading("Exportando...", { id: "export" });
      await apiClient.download(`/reports/backlog/export?recent_id=${recentId}&previous_id=${previousId}`, `backlog-${sheetRecent}.xlsx`);
      toast.success("Download iniciado", { id: "export" });
    } catch (e: any) {
      toast.error("Erro ao exportar", { id: "export", description: e.message });
    }
  };

  const handleExportPdf = async () => {
    if (!pdfRef.current) return;
    try {
      toast.loading("Gerando PDF...", { id: "pdf" });
      await exportElementToPdf(pdfRef.current, `dashboard-pats-${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF gerado", { id: "pdf" });
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { id: "pdf", description: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard Geral de PATs" 
        description={
          <div className="flex flex-col gap-1">
            <span>Resumo executivo do backlog corporativo</span>
            {weekStart && weekEnd && (
              <span className="text-xs">
                Semana de referência: <span className="font-medium">{formatDateBR(weekStart)} a {formatDateBR(weekEnd)}</span>
              </span>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-4 mr-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Atual:</span>
            <Select value={String(recentId)} onValueChange={v => setRecentId(Number(v))}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {uploads.map(u => <SelectItem key={u.id} value={String(u.id)} disabled={u.id === previousId}>{formatDateBR(u.reference_date)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Anterior:</span>
            <Select value={String(previousId)} onValueChange={v => setPreviousId(Number(v))}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {uploads.map(u => <SelectItem key={u.id} value={String(u.id)} disabled={u.id === recentId}>{formatDateBR(u.reference_date)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
          <Button size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Exportar</Button>
        </div>
      </PageHeader>

      <div ref={pdfRef} className="space-y-6 bg-background p-2">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Resumo executivo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{summary}</p>
          </CardContent>
        </Card>

        {validationLog && validationLog.length > 0 && (
          <Alert variant="default" className="border-warning/40 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle>Log de validação</AlertTitle>
            <AlertDescription>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {validationLog.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Kpi icon={ClipboardList} label="PATs (atual)" value={totalRecent} />
          <Kpi icon={Users} label="MXM atual" value={mxmRecent ?? 0} tone="info" />
          <Kpi icon={Users} label="MXM anterior" value={mxmPrevious ?? 0} />
          <Kpi icon={Sparkles} label="Novos MXM" value={totals.novo || 0} tone="success" />
          <Kpi icon={LogOut} label="Saíram do recorte" value={totals.saiu_mxm || 0} />
          <Kpi icon={RefreshCw} label="Alterados" value={totals.alterado || 0} tone="info" />
          <Kpi icon={CalendarDays} label="Prazo para a semana" value={totals.vencendo_semana || 0} tone="warning" />
          <Kpi icon={Clock} label="Postergados" value={totals.postergado || 0} />
          <Kpi icon={AlertTriangle} label="Atrasados" value={totals.atrasado || 0} tone="danger" />
          <Kpi icon={Calendar} label="Sem prazo" value={totals.sem_prazo || 0} />
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-6 gap-6">
          <DashboardCharts uploads={uploads} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backlog detalhado</CardTitle>
          <CardDescription>Recorte MXM (Aberto Com = MXM). Clique em qualquer linha para abrir o detalhe e o histórico.</CardDescription>
        </CardHeader>
        <CardContent>
          <PatTable pats={pats} />
        </CardContent>
      </Card>
    </div>
  );
}

function buildSummary(current: any): string {
  if (!current) return "";
  const dRec = formatDateBR(current.dateRecent);
  const dPrev = formatDateBR(current.datePrevious);
  const wS = formatDateBR(current.weekStart);
  const wE = formatDateBR(current.weekEnd);
  const mA = current.mxmRecent ?? 0;
  const mP = current.mxmPrevious ?? 0;
  const novos = current.totals.novo || 0;
  const saiu = current.totals.saiu_mxm || 0;
  const semana = current.totals.vencendo_semana || 0;
  const atras = current.totals.atrasado || 0;
  const post = current.totals.postergado || 0;
  const sem = current.totals.sem_prazo || 0;
  return `A consulta atual de ${dRec} possui ${mA} PATs abertos com MXM, contra ${mP} na consulta anterior de ${dPrev}. Foram identificados ${novos} novos PATs no recorte MXM e ${saiu} PATs que saíram desse recorte. Para a semana de ${wS} a ${wE}, há ${semana} PATs com prazo previsto, ${atras} atrasados, ${post} com prazo postergado e ${sem} sem prazo informado.`;
}