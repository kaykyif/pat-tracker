import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadSettings, saveSettings } from "@/lib/local-store";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  const [staleDays, setStaleDays] = useState(14);
  const [closed, setClosed] = useState("Encerrado, Concluído, Fechado, Cancelado, Resolvido");

  useEffect(() => {
    const s = loadSettings();
    setStaleDays(s.staleDays);
    setClosed(s.closedStatuses.join(", "));
  }, []);

  const save = () => {
    const closedStatuses = closed.split(",").map((s) => s.trim()).filter(Boolean);
    saveSettings({ staleDays, closedStatuses });
    toast.success("Configurações salvas");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Configurações" description="Personalize regras de classificação dos PATs. Salvas neste navegador." />
      <Card>
        <CardHeader><CardTitle className="text-base">Regras de análise</CardTitle><CardDescription>Aplicadas a novas análises.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dias sem atualização para considerar parado</Label>
            <Input type="number" min={1} value={staleDays} onChange={(e) => setStaleDays(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Status considerados como encerrados</Label>
            <Textarea value={closed} onChange={(e) => setClosed(e.target.value)} rows={2} placeholder="Separados por vírgula" />
            <p className="text-xs text-muted-foreground">PATs com estes status não entram em atraso, vencimento ou parado.</p>
          </div>
          <Button onClick={save}>Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}