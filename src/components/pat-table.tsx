import { useMemo, useState } from "react";
import { Search, StickyNote, X, ClipboardX, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PatBadge } from "./pat-badge";
import { PatInfoDrawer } from "./pat-info-drawer";
import type { ClassifiedPat, PatCategory } from "@/lib/pat-types";
import { getAllNotes } from "@/lib/notes-store";
import { formatDateBR } from "@/lib/excel-utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const CATEGORY_OPTIONS: { value: PatCategory | "all"; label: string }[] = [
  { value: "all", label: "Todas categorias" },
  { value: "novo", label: "Novos" },
  { value: "alterado", label: "Alterados" },
  { value: "atrasado", label: "Atrasados" },
  { value: "vencendo_semana", label: "Prazo para a semana" },
  { value: "postergado", label: "Postergados" },
  { value: "sem_prazo", label: "Sem prazo" },
  { value: "aberto_mxm", label: "Abertos com MXM" },
  { value: "saiu_mxm", label: "Saíram do recorte MXM" },
  { value: "sem_levantamento", label: "Sem levantamento" },
  { value: "encerrado", label: "Encerrados" },
];

const PRAZO_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos prazos" },
  { value: "com", label: "Com prazo" },
  { value: "sem", label: "Sem prazo" },
  { value: "semana", label: "Na semana de referência" },
  { value: "atraso", label: "Em atraso" },
];

const PAGE_SIZE = 25;

export function PatTable({ pats, onUpdate }: { pats: ClassifiedPat[]; onUpdate?: () => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PatCategory | "all">("all");
  const [sistemaFilter, setSistemaFilter] = useState<string>("all");
  const [usuarioFilter, setUsuarioFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prazoFilter, setPrazoFilter] = useState<string>("all");
  const [patFilter, setPatFilter] = useState<string>("");
  const [tipoPrazoFilter, setTipoPrazoFilter] = useState<string>("all");
  const [abertoComFilter, setAbertoComFilter] = useState<string>("all");
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ClassifiedPat | null>(null);
  const notes = useMemo(() => getAllNotes(), [selected]);

  const handleSort = (key: string) => {
    setSortConfig(curr => {
      if (curr?.key === key) return curr.dir === 'asc' ? { key, dir: 'desc' } : null;
      return { key, dir: 'asc' };
    });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ChevronsUpDown className="ml-1 h-3 w-3 inline opacity-30" />;
    return sortConfig.dir === 'asc' ? <ChevronUp className="ml-1 h-3 w-3 inline" /> : <ChevronDown className="ml-1 h-3 w-3 inline" />;
  };

  const unique = (key: "cliente" | "status" | "modulo" | "tipo_prazo" | "aberto_com") =>
    Array.from(new Set(pats.map((p) => p.recent?.[key] || p.previous?.[key]).filter(Boolean) as string[])).sort();

  const sistemas = useMemo(() => unique("modulo"), [pats]);
  const usuarios = useMemo(() => unique("cliente"), [pats]);
  const statuses = useMemo(() => unique("status"), [pats]);
  const tiposPrazo = useMemo(() => unique("tipo_prazo"), [pats]);
  const abertosCom = useMemo(() => unique("aberto_com"), [pats]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const pf = patFilter.trim().toLowerCase();
    return pats.filter((p) => {
      const cur = p.recent || p.previous;
      if (!cur) return false;
      if (category !== "all" && !p.categories.includes(category)) return false;
      if (sistemaFilter !== "all" && cur.modulo !== sistemaFilter) return false;
      if (usuarioFilter !== "all" && cur.cliente !== usuarioFilter) return false;
      if (statusFilter !== "all" && cur.status !== statusFilter) return false;
      if (tipoPrazoFilter !== "all" && (cur.tipo_prazo || "") !== tipoPrazoFilter) return false;
      if (abertoComFilter !== "all" && (cur.aberto_com || "") !== abertoComFilter) return false;
      if (prazoFilter === "com" && !cur.prazo) return false;
      if (prazoFilter === "sem" && !!cur.prazo) return false;
      if (prazoFilter === "semana" && !p.categories.includes("vencendo_semana")) return false;
      if (prazoFilter === "atraso" && !p.categories.includes("atrasado")) return false;
      if (pf && !String(p.id).toLowerCase().includes(pf)) return false;
      if (s) {
        const hay = `${p.id} ${cur.titulo || ""} ${cur.cliente || ""} ${cur.modulo || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (!mostrarEncerrados && p.categories.includes("encerrado")) return false;
      return true;
    });
  }, [pats, search, category, sistemaFilter, usuarioFilter, statusFilter, prazoFilter, patFilter, tipoPrazoFilter, abertoComFilter, mostrarEncerrados]);

  const sortedAndFiltered = useMemo(() => {
    let result = [...filtered];
    if (sortConfig) {
      result.sort((a, b) => {
        const curA = a.recent || a.previous;
        const curB = b.recent || b.previous;
        let valA: any;
        let valB: any;
        
        switch (sortConfig.key) {
          case 'id': valA = a.id; valB = b.id; break;
          case 'status': valA = curA?.status; valB = curB?.status; break;
          case 'abertura': valA = curA?.data_abertura; valB = curB?.data_abertura; break;
          case 'prazo': valA = curA?.prazo; valB = curB?.prazo; break;
          case 'dias': valA = a.dias_aberto ?? -1; valB = b.dias_aberto ?? -1; break;
        }

        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        
        const cmp = valA < valB ? -1 : 1;
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [filtered, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(sortedAndFiltered.length / PAGE_SIZE));
  const paginated = sortedAndFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const resetFilters = () => {
    setSearch(""); setCategory("all"); setSistemaFilter("all"); setUsuarioFilter("all");
    setStatusFilter("all"); setPrazoFilter("all"); setPatFilter(""); setTipoPrazoFilter("all");
    setAbertoComFilter("all"); setPage(0);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar em qualquer campo..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Input placeholder="Filtrar por PAT (nº)" value={patFilter} onChange={(e) => { setPatFilter(e.target.value); setPage(0); }} />
        <Select value={category} onValueChange={(v) => { setCategory(v as any); setPage(0); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sistemaFilter} onValueChange={(v) => { setSistemaFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Sistema" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos sistemas</SelectItem>
            {sistemas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={usuarioFilter} onValueChange={(v) => { setUsuarioFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos usuários</SelectItem>
            {usuarios.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {statuses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prazoFilter} onValueChange={(v) => { setPrazoFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>{PRAZO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tipoPrazoFilter} onValueChange={(v) => { setTipoPrazoFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Tipo de Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {tiposPrazo.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={abertoComFilter} onValueChange={(v) => { setAbertoComFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Aberto Com" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {abertosCom.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Switch id="show-encerrados" checked={mostrarEncerrados} onCheckedChange={setMostrarEncerrados} />
          <Label htmlFor="show-encerrados" className="text-sm font-medium leading-none cursor-pointer">Encerrados</Label>
        </div>
        <Button variant="ghost" size="sm" onClick={resetFilters} className="justify-start">
          <X className="mr-1 h-3 w-3" /> Limpar filtros
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('id')}>PAT <SortIcon columnKey="id" /></TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('status')}>Status <SortIcon columnKey="status" /></TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('abertura')}>Abertura <SortIcon columnKey="abertura" /></TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('prazo')}>Prazo <SortIcon columnKey="prazo" /></TableHead>
              <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort('dias')}>Tempo aberto <SortIcon columnKey="dias" /></TableHead>
              <TableHead>Categorias</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Nenhum PAT encontrado</TableCell></TableRow>
            )}
            {paginated.map((p) => {
              const cur = p.recent || p.previous;
              const hasNote = !!notes[p.id]?.text;
              const dias = p.dias_aberto ?? null;
              const ageClass =
                dias === null
                  ? "text-muted-foreground"
                  : dias > 180
                  ? "text-destructive font-semibold"
                  : dias > 90
                  ? "text-warning font-medium"
                  : "text-foreground";
              const rowAccent = p.categories.includes("atrasado")
                ? "border-l-2 border-l-destructive"
                : p.categories.includes("vencendo_semana")
                ? "border-l-2 border-l-warning"
                : p.categories.includes("novo")
                ? "border-l-2 border-l-success"
                : p.categories.includes("postergado")
                ? "border-l-2 border-l-purple-500"
                : "";
              const opacityClass = p.categories.includes("encerrado") ? "opacity-60 bg-muted/20" : "";
              return (
                <TableRow key={p.id} className={`cursor-pointer ${rowAccent} ${opacityClass}`} onClick={() => setSelected(p)}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      {p.id}
                      {hasNote && <StickyNote className="h-3 w-3 text-warning" title="Possui notas" />}
                      {p.categories.includes("sem_levantamento") && <ClipboardX className="h-3 w-3 text-destructive" title="Sem levantamento preenchido" />}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">{cur?.titulo || "—"}</TableCell>
                  <TableCell>{cur?.cliente || "—"}</TableCell>
                  <TableCell>
                    {cur?.status || "—"}
                    {p.categories.includes("encerrado") && cur?.encerramento && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        em {formatDateBR(cur.encerramento)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{formatDateBR(cur?.data_abertura) || "—"}</TableCell>
                  <TableCell>
                    {formatDateBR(cur?.prazo) || "—"}
                    {p.prazo_anterior && p.categories.includes("postergado") && (
                      <div className="text-[10px] text-muted-foreground line-through">era {formatDateBR(p.prazo_anterior)}</div>
                    )}
                  </TableCell>
                  <TableCell className={`text-xs ${ageClass}`}>
                    {dias === null ? "—" : `${dias}d`}
                    {p.categories.includes("encerrado") && (
                      <div className="text-[10px] font-normal text-muted-foreground">(total)</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.categories.filter((c) => c !== "sem_alteracao").slice(0, 3).map((c) => <PatBadge key={c} category={c} />)}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>{filtered.length} PATs • Página {page + 1} de {pageCount}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)}>Primeira</Button>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>Última</Button>
        </div>
      </div>

      <PatInfoDrawer pat={selected} open={!!selected} onClose={() => setSelected(null)} onUpdate={onUpdate} />
    </div>
  );
}