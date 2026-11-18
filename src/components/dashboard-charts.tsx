import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateBR } from "@/lib/excel-utils";

type UploadRecord = {
  id: number;
  reference_date: string;
  total_pats: number;
  total_mxm: number;
};

export function DashboardCharts({ uploads }: { uploads: UploadRecord[] }) {
  const chartData = useMemo(() => {
    // Sort chronologically
    const sorted = [...uploads].sort((a, b) => 
      new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime()
    );

    return sorted.map(u => ({
      name: formatDateBR(u.reference_date)?.substring(0, 5), // Ex: 08/07
      fullDate: formatDateBR(u.reference_date),
      Total: u.total_pats,
      "Recorte MXM": u.total_mxm
    }));
  }, [uploads]);

  if (chartData.length < 2) return null;

  return (
    <Card className="col-span-full xl:col-span-4 shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle className="text-base">Evolução do Volume de PATs</CardTitle>
        <CardDescription>Comparativo histórico com base nos arquivos importados.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMxm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dx={-10} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
              labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Area type="monotone" dataKey="Total" stroke="hsl(var(--muted-foreground))" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={2} />
            <Area type="monotone" dataKey="Recorte MXM" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMxm)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
