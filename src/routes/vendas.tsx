import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { BreakdownTable } from "@/components/BreakdownTable";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSales } from "@/hooks/use-sales";
import { computeKpis } from "@/lib/aggregate";
import { brl, factor, pct, qty, shortDate } from "@/lib/format";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas — Price Analytics" },
      {
        name: "description",
        content:
          "Todos os itens vendidos com custo, lucro e markup, filtrados por data, produto, vendedor e plataforma.",
      },
      { property: "og:title", content: "Vendas — Price Analytics" },
      {
        property: "og:description",
        content: "Detalhe item a item das notas fiscais com lucro e markup calculados.",
      },
    ],
  }),
  component: SalesPage,
});

const ALL = "__all__";

function SalesPage() {
  const { data: rows = [], isLoading } = useSales();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [product, setProduct] = useState("");
  const [seller, setSeller] = useState(ALL);
  const [platform, setPlatform] = useState(ALL);

  const sellers = useMemo(() => [...new Set(rows.map((r) => r.seller))].sort(), [rows]);
  const platforms = useMemo(() => [...new Set(rows.map((r) => r.platform))].sort(), [rows]);

  const filtered = useMemo(() => {
    const term = product.trim().toLowerCase();
    return rows.filter((row) => {
      if (from && row.date < from) return false;
      if (to && row.date > to) return false;
      if (seller !== ALL && row.seller !== seller) return false;
      if (platform !== ALL && row.platform !== platform) return false;
      if (term && !`${row.sku} ${row.product}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, from, to, product, seller, platform]);

  const kpis = computeKpis(filtered);

  return (
    <AppLayout title="Vendas" description="Itens das notas fiscais com custo, lucro e markup">
      <Panel title="Filtros">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Produto / SKU</Label>
            <Input
              placeholder="Buscar"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vendedor</Label>
            <Select value={seller} onValueChange={setSeller}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {sellers.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {platforms.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            {filtered.length} item(ns) • Faturamento{" "}
            <strong className="num text-foreground">{brl(kpis.revenue)}</strong> • Lucro{" "}
            <strong className="num text-positive">{brl(kpis.profit)}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom("");
              setTo("");
              setProduct("");
              setSeller(ALL);
              setPlatform(ALL);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </Panel>

      <div className="surface-panel mt-4 overflow-x-auto rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nota</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Vl. unit.</TableHead>
              <TableHead className="text-right">Vl. total</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead className="text-right">Custo unit.</TableHead>
              <TableHead className="text-right">Custo total</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">Markup</TableHead>
              <TableHead className="text-right">Margem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-muted-foreground">
                  Nenhuma venda encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="num text-xs">{row.invoiceNumber}</TableCell>
                  <TableCell className="num text-xs whitespace-nowrap">
                    {shortDate(row.date)}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">
                    <span className="block truncate">{row.product}</span>
                    <span className="num text-[11px] text-muted-foreground">{row.sku}</span>
                  </TableCell>
                  <TableCell className="num text-right">{qty(row.quantity)}</TableCell>
                  <TableCell className="num text-right">{brl(row.unitValue)}</TableCell>
                  <TableCell className="num text-right">{brl(row.totalValue)}</TableCell>
                  <TableCell className="max-w-[12rem] truncate">{row.customer}</TableCell>
                  <TableCell className="max-w-[10rem] truncate">{row.seller}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.platform}</TableCell>
                  <TableCell className="num text-right">{brl(row.unitCost)}</TableCell>
                  <TableCell className="num text-right">{brl(row.totalCost)}</TableCell>
                  <TableCell
                    className={`num text-right ${row.profit >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {brl(row.profit)}
                  </TableCell>
                  <TableCell className="num text-right">{factor(row.markup)}</TableCell>
                  <TableCell className="num text-right">{pct(row.margin)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}