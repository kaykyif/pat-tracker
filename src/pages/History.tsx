import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, FileSpreadsheet, ArrowRightCircle, ArrowLeftCircle } from "lucide-react";
import { useAnalysis } from "@/hooks/use-analysis";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { formatDateBR } from "@/lib/excel-utils";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Archive } from "lucide-react";

export default function History() {
  const { uploads, refreshUploads, recentId, previousId, setRecentId, setPreviousId } = useAnalysis();
  const nav = useNavigate();

  const remove = async (id: number) => {
    if (!confirm("Excluir este upload? (Também excluirá todos os PATs associados a ele no banco)")) return;
    try {
      await apiClient.delete(`/uploads/${id}`);
      toast.success("Upload excluído");
      refreshUploads();
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    }
  };

  const setAsRecent = (id: number) => {
    setRecentId(id);
    nav("/");
  };

  const setAsPrevious = (id: number) => {
    setPreviousId(id);
    nav("/");
  };

  const { data: encerradosHistory, isLoading: isLoadingEncerrados } = useQuery({
    queryKey: ["encerrados-history"],
    queryFn: async () => {
      return await apiClient.get("/reports/encerrados/history");
    }
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Histórico de Uploads" description="Gerencie todos os arquivos que foram enviados para o sistema." />
      
      <Tabs defaultValue="backlog" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="backlog">Backlog Semanal (MXM)</TabsTrigger>
          <TabsTrigger value="encerrados">Lotes de Encerrados</TabsTrigger>
        </TabsList>

        <TabsContent value="backlog">
          <Card>
            <CardHeader><CardTitle className="text-base">Uploads salvos</CardTitle><CardDescription>{uploads.length} total</CardDescription></CardHeader>
            <CardContent>
          {uploads.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum upload ainda. Importe um arquivo da MXM para começar.</p>
              <Button onClick={() => nav("/nova-analise")}>Novo upload</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data de Referência</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Total PATs</TableHead>
                  <TableHead>PATs MXM</TableHead>
                  <TableHead>Data Upload</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => (
                  <TableRow key={u.id} className={recentId === u.id ? "bg-primary/5" : previousId === u.id ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {formatDateBR(u.reference_date)}
                      {recentId === u.id && <span className="ml-2 text-xs font-semibold text-primary">(Atual)</span>}
                      {previousId === u.id && <span className="ml-2 text-xs font-semibold text-muted-foreground">(Anterior)</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.file_name}</TableCell>
                    <TableCell>{u.total_pats}</TableCell>
                    <TableCell>{u.total_mxm}</TableCell>
                    <TableCell className="text-xs">{format(new Date(u.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" title="Usar como Atual" disabled={recentId === u.id} onClick={() => setAsRecent(u.id)}>
                          <ArrowRightCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Usar como Anterior" disabled={previousId === u.id} onClick={() => setAsPrevious(u.id)}>
                          <ArrowLeftCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(u.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="encerrados">
        <Card>
          <CardHeader><CardTitle className="text-base">Importações de Encerrados</CardTitle><CardDescription>{encerradosHistory?.length || 0} lotes registrados</CardDescription></CardHeader>
          <CardContent>
            {isLoadingEncerrados ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : !encerradosHistory || encerradosHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Archive className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma importação de PATs encerrados encontrada.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data e Hora da Importação</TableHead>
                    <TableHead>Total de PATs Processados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {encerradosHistory.map((h: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {h.created_at ? format(new Date(h.created_at), "dd/MM/yyyy HH:mm") : "Desconhecido"}
                      </TableCell>
                      <TableCell>{h.total_pats}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}