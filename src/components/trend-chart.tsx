import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { loadAnalyses } from "@/lib/local-store";
import { format } from "date-fns";

export function TrendChart() {
  const data = useMemo(() => {
    const all = loadAnalyses();
    // ordem cronológica crescente (loadAnalyses retorna decrescente)
    return [...all].reverse().slice(-12).map((a) => ({
      name: format(new Date(a.createdAt), "dd/MM"),
      total: a.result.totalRecent,
      atrasados: a.result.totals.atrasado || 0,
      novos: a.result.totals.novo || 0,
      postergados: a.result.totals.postergado || 0,
    }));
  }, []);

  if (data.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendência do backlog</CardTitle>
          <CardDescription>Importe mais análises para ver a evolução ao longo do tempo.</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          Faça pelo menos duas importações para gerar a tendência.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendência do backlog</CardTitle>
        <CardDescription>Evolução nas últimas {data.length} análises.</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gAtr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#gTotal)" name="Total" />
            <Area type="monotone" dataKey="atrasados" stroke="hsl(var(--destructive))" fill="url(#gAtr)" name="Atrasados" />
            <Area type="monotone" dataKey="novos" stroke="hsl(var(--success))" fill="transparent" name="Novos" />
            <Area type="monotone" dataKey="postergados" stroke="hsl(280 70% 55%)" fill="transparent" name="Postergados" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}