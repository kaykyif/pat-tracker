import { useRef, useMemo } from "react";
import { useAnalysis } from "@/hooks/use-analysis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Image as ImageIcon, Loader2 } from "lucide-react";
import { exportElementToPdf } from "@/lib/export-pdf";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateBR } from "@/lib/excel-utils";
import { PageHeader } from "@/components/page-header";

export default function QuadroDiretoria() {
  const { currentResult, uploads, recentId, previousId, setRecentId, setPreviousId, loading } = useAnalysis();
  const reportRef = useRef<HTMLDivElement>(null);

  const matrix = currentResult?.matrix || [];
  
  const totals = useMemo(() => {
    if (!matrix.length) return null;
    const t = {
      saldo_anterior: 0, novos: 0, encerrados: 0, saldo_atual: 0,
      aging_0_30: 0, aging_31_60: 0, aging_60_plus: 0,
      resp_interno: 0, resp_mxm: 0, sem_prazo: 0, adiados_atrasados: 0
    };
    for (const m of matrix) {
      t.saldo_anterior += m.saldo_anterior;
      t.novos += m.novos;
      t.encerrados += m.encerrados;
      t.saldo_atual += m.saldo_atual;
      t.aging_0_30 += m.aging_0_30;
      t.aging_31_60 += m.aging_31_60;
      t.aging_60_plus += m.aging_60_plus;
      t.resp_interno += m.resp_interno;
      t.resp_mxm += m.resp_mxm;
      t.sem_prazo += m.sem_prazo;
      t.adiados_atrasados += m.adiados_atrasados;
    }
    return t;
  }, [matrix]);

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    try {
      toast.loading("Gerando PDF...", { id: "pdf" });
      await exportElementToPdf(reportRef.current, `quadro-diretoria-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF gerado com sucesso!", { id: "pdf" });
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { id: "pdf", description: e.message });
    }
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    try {
      toast.loading("Gerando Imagem...", { id: "img" });
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `quadro-diretoria-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagem gerada com sucesso!", { id: "img" });
    } catch (e: any) {
      toast.error("Erro ao gerar Imagem", { id: "img", description: e.message });
    }
  };

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
            <CardDescription>Faça upload de pelo menos 2 relatórios da MXM para gerar o Quadro da Diretoria.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!currentResult || !totals) return null;

  const dateRecent = currentResult.dateRecent ? formatDateBR(currentResult.dateRecent) : "";
  
  // Calculate days passed between previous and recent
  let diasPassados = 0;
  if (currentResult.dateRecent && currentResult.datePrevious) {
    const d1 = new Date(currentResult.dateRecent.split("T")[0]);
    const d2 = new Date(currentResult.datePrevious.split("T")[0]);
    diasPassados = Math.abs(Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quadro Diretoria (Relatório Gerencial)" description="A foto exata da movimentação dos PATs para apresentação.">
        <div className="flex flex-wrap items-center gap-4 mr-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Mês Atual:</span>
            <Select value={String(recentId)} onValueChange={v => setRecentId(Number(v))}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {uploads.map(u => <SelectItem key={u.id} value={String(u.id)} disabled={u.id === previousId}>{formatDateBR(u.reference_date)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Mês Anterior:</span>
            <Select value={String(previousId)} onValueChange={v => setPreviousId(Number(v))}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {uploads.map(u => <SelectItem key={u.id} value={String(u.id)} disabled={u.id === recentId}>{formatDateBR(u.reference_date)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}><Download className="mr-2 h-4 w-4" /> PDF</Button>
          <Button size="sm" onClick={handleExportImage}><ImageIcon className="mr-2 h-4 w-4" /> PNG</Button>
        </div>
      </PageHeader>

      <div className="overflow-x-auto pb-4 pt-2">
        <div ref={reportRef} className="min-w-[1000px] bg-white text-black p-6 rounded-md shadow-sm border" style={{ fontFamily: 'Arial, sans-serif' }}>
          
          {/* Top Info Boxes */}
          <div className="w-[300px] mb-4 border-2 border-[#1E3A8A]">
            <div className="flex border-b border-[#1E3A8A]">
              <div className="w-1/2 bg-[#1E3A8A] text-white text-xs font-bold p-1 px-2 text-left border-r border-[#1E3A8A]">Dias Passados</div>
              <div className="w-1/2 bg-[#D1D5DB] text-center text-xs font-bold p-1">{diasPassados}</div>
            </div>
            <div className="flex">
              <div className="w-1/2 bg-[#1E3A8A] text-white text-xs font-bold p-1 px-2 text-left border-r border-[#1E3A8A]">Geração do Relatório em</div>
              <div className="w-1/2 bg-[#D1D5DB] text-center text-xs font-bold p-1">{dateRecent}</div>
            </div>
          </div>

          {/* Matrix Table */}
          <table className="w-full text-xs border-collapse text-center">
            <thead>
              <tr>
                <th colSpan={12} className="border-2 border-black p-1 font-bold bg-white">MXM - RELATÓRIO SEMANAL DE MOVIMENTAÇÃO DE PATs</th>
              </tr>
              <tr>
                <th colSpan={3} className="border-2 border-black bg-[#1E3A8A] text-white p-1">Período</th>
                <th colSpan={9} className="border-2 border-black bg-white p-1">{currentResult.datePrevious ? formatDateBR(currentResult.datePrevious) : ""} Até {dateRecent}</th>
              </tr>
              <tr className="bg-[#1E3A8A] text-white border-2 border-black">
                <th className="border-x border-t border-black p-1 align-bottom min-w-[120px] !border-b-0">Natureza</th>
                <th className="border-x border-t border-black p-1 align-bottom !border-b-0">Saldo Anterior</th>
                <th colSpan={2} className="border border-black p-1">Movimentação</th>
                <th className="border-x border-t border-black p-1 align-bottom !border-b-0">Saldo Atual</th>
                <th colSpan={3} className="border border-black p-1">Aging</th>
                <th colSpan={2} className="border border-black p-1">Responsável</th>
                <th className="border-x border-t border-black p-1 align-bottom !border-b-0">S/ Prazo</th>
                <th className="border-x border-t border-black p-1 align-bottom leading-tight !border-b-0">Adiados/Atrasados<br/>Historicamente</th>
              </tr>
              <tr className="bg-[#1E3A8A] text-white border-2 border-black">
                <th className="border-x border-b border-black p-0 !border-t-0"></th>
                <th className="border-x border-b border-black p-0 !border-t-0"></th>
                <th className="border border-black p-1">Novos</th>
                <th className="border border-black p-1">Encerrados</th>
                <th className="border-x border-b border-black p-0 !border-t-0"></th>
                <th className="border border-black p-1">0 - 30 Dias</th>
                <th className="border border-black p-1">31 - 60 Dias</th>
                <th className="border border-black p-1">&gt; 60 Dias</th>
                <th className="border border-black p-1">Interno</th>
                <th className="border border-black p-1">MXM</th>
                <th className="border-x border-b border-black p-0 !border-t-0"></th>
                <th className="border-x border-b border-black p-0 !border-t-0"></th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((m: any, i: number) => (
                <tr key={m.natureza} className={i % 2 === 0 ? "bg-white" : "bg-gray-100"}>
                  <td className="border border-black p-1 font-medium text-center">{m.natureza}</td>
                  <td className="border border-black p-1">{m.saldo_anterior}</td>
                  <td className="border border-black p-1">{m.novos}</td>
                  <td className="border border-black p-1">{m.encerrados > 0 ? `-${m.encerrados}` : m.encerrados}</td>
                  <td className="border border-black p-1">{m.saldo_atual}</td>
                  <td className="border border-black p-1 bg-[#E5E7EB]">{m.aging_0_30}</td>
                  <td className="border border-black p-1 bg-[#E5E7EB]">{m.aging_31_60}</td>
                  <td className="border border-black p-1 bg-[#E5E7EB]">{m.aging_60_plus}</td>
                  <td className="border border-black p-1">{m.resp_interno}</td>
                  <td className="border border-black p-1">{m.resp_mxm}</td>
                  <td className="border border-black p-1">{m.sem_prazo}</td>
                  <td className="border border-black p-1">{m.adiados_atrasados}</td>
                </tr>
              ))}
              <tr className="bg-[#9CA3AF] text-black font-bold border-2 border-black">
                <td className="border border-black p-1 text-center">Total</td>
                <td className="border border-black p-1">{totals.saldo_anterior}</td>
                <td className="border border-black p-1">{totals.novos}</td>
                <td className="border border-black p-1">{totals.encerrados > 0 ? `-${totals.encerrados}` : totals.encerrados}</td>
                <td className="border border-black p-1">{totals.saldo_atual}</td>
                <td className="border border-black p-1">{totals.aging_0_30}</td>
                <td className="border border-black p-1">{totals.aging_31_60}</td>
                <td className="border border-black p-1">{totals.aging_60_plus}</td>
                <td className="border border-black p-1">{totals.resp_interno}</td>
                <td className="border border-black p-1">{totals.resp_mxm}</td>
                <td className="border border-black p-1">{totals.sem_prazo}</td>
                <td className="border border-black p-1">{totals.adiados_atrasados}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
