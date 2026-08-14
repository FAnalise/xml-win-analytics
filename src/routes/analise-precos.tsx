import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { EmptyState, Panel } from "@/components/Panel";
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
import { breakdown } from "@/lib/aggregate";
import { brl, factor, pct, qty } from "@/lib/format";

export const Route = createFileRoute("/analise-precos")({
  head: () => ({
    meta: [
      { title: "Análise de Preços — Price Analytics" },
      {
        name: "description",
        content:
          "Compare preço médio, custo, lucro, markup e margem de um produto entre plataformas e vendedores.",
      },
      { property: "og:title", content: "Análise de Preços — Price Analytics" },
      {
        property: "og:description",
        content: "Comparativo real de desempenho de um SKU por plataforma de venda.",
      },
    ],
  }),
  component: PriceAnalysisPage,
});

const ALL = "__all__";
const SEP = "\u0000";

function PriceAnalysisPage() {
  const { data: rows = [], isLoading } = useSales();
  const [sku, setSku] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [seller, setSeller] = useState(ALL);
  const [platform, setPlatform] = useState(ALL);

  const skus = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) if (!map.has(row.sku)) map.set(row.sku, row.product);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const sellers = useMemo(() => [...new Set(rows.map((r) => r.seller))].sort(), [rows]);
  const platforms = useMemo(() => [...new Set(rows.map((r) => r.platform))].sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (sku !== ALL && row.sku !== sku) return false;
        if (from && row.date < from) return false;
        if (to && row.date > to) return false;
        if (seller !== ALL && row.seller !== seller) return false;
        if (platform !== ALL && row.platform !== platform) return false;
        return true;
      }),
    [rows, sku, from, to, seller, platform],
  );

  const groups = useMemo(() => {
    const names = new Map<string, { product: string; sku: string }>();
    for (const row of filtered) {
      const key = `${row.platform}${SEP}${row.seller}`;
      if (!names.has(key)) names.set(key, { product: row.product, sku: row.sku });
    }
    return breakdown(filtered, (r) => `${r.platform}${SEP}${r.seller}`).map((g) => {
      const [platformName = "—", sellerName = "—"] = g.name.split(SEP);
      const info = names.get(g.name);
      return {
        ...g,
        platform: platformName,
        seller: sellerName,
        product: info?.product ?? "—",
        sku: info?.sku ?? "—",
        avgPrice: g.units > 0 ? g.value / g.units : null,
      };
    });
  }, [filtered]);

  const best = useMemo(() => {
    const pick = (get: (g: (typeof groups)[number]) => number | null) => {
      let winner: string | null = null;
      let value = -Infinity;
      for (const g of groups) {
        const v = get(g);
        if (v === null || !Number.isFinite(v)) continue;
        if (v > value) {
          value = v;
          winner = g.name;
        }
      }
      return groups.length > 1 ? winner : null;
    };
    return {
      markup: pick((g) => g.markup),
      margin: pick((g) => g.margin),
      price: pick((g) => g.avgPrice),
    };
  }, [groups]);

  const selectedProduct = sku === ALL ? null : (skus.find(([s]) => s === sku)?.[1] ?? sku);

  return (
    <AppLayout
      title="Análise de Preços"
      description="Compare o desempenho de um produto entre as plataformas de venda"
    >
      <Panel title="Filtros" subtitle="Selecione um produto para comparar as plataformas">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Produto / SKU</Label>
            <Select value={sku} onValueChange={setSku}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os produtos</SelectItem>
                {skus.map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {code} — {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            {selectedProduct ? (
              <>
                Produto: <strong className="text-foreground">{selectedProduct}</strong>
              </>
            ) : (
              "Nenhum produto selecionado — exibindo todos"
            )}{" "}
            • {groups.length} plataforma(s)
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSku(ALL);
              setFrom("");
              setTo("");
              setSeller(ALL);
              setPlatform(ALL);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Highlight
          title="Maior markup"
          group={groups.find((g) => g.name === best.markup)}
          value={(g) => factor(g.markup)}
        />
        <Highlight
          title="Maior margem"
          group={groups.find((g) => g.name === best.margin)}
          value={(g) => pct(g.margin)}
        />
        <Highlight
          title="Maior preço médio"
          group={groups.find((g) => g.name === best.price)}
          value={(g) => (g.avgPrice === null ? "Sem dados" : brl(g.avgPrice))}
        />
      </div>

      <div className="surface-panel mt-4 overflow-x-auto rounded-xl">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : groups.length === 0 ? (
          <div className="p-4">
            <EmptyState message="Sem dados para os filtros selecionados." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço médio</TableHead>
                <TableHead className="text-right">Custo real</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Mk</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.name}>
                  <TableCell className="max-w-[16rem] truncate">{g.product}</TableCell>
                  <TableCell className="num text-xs">{g.sku}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {g.platform}
                    {best.price === g.name ? <Badge>preço</Badge> : null}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate">{g.seller}</TableCell>
                  <TableCell className="num text-right">{qty(g.units)}</TableCell>
                  <TableCell className="num text-right">
                    {g.avgPrice === null ? "Sem dados" : brl(g.avgPrice)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {g.cost > 0 ? brl(g.cost) : "Sem dados"}
                  </TableCell>
                  <TableCell className="num text-right">{brl(g.value)}</TableCell>
                  <TableCell
                    className={`num text-right ${g.profit >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {brl(g.profit)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {g.markup === null ? "Sem dados" : factor(g.markup)}
                    {best.markup === g.name ? <Badge>maior</Badge> : null}
                  </TableCell>
                  <TableCell className="num text-right">
                    {g.margin === null ? "Sem dados" : pct(g.margin)}
                    {best.margin === g.name ? <Badge>maior</Badge> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppLayout>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      {children}
    </span>
  );
}

type Group = {
  name: string;
  platform: string;
  seller: string;
  markup: number | null;
  margin: number | null;
  avgPrice: number | null;
};

function Highlight({
  title,
  group,
  value,
}: {
  title: string;
  group?: Group;
  value: (g: Group) => string;
}) {
  return (
    <div className="surface-panel rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      {group ? (
        <>
          <p className="mt-1 text-lg font-semibold tracking-tight">{value(group)}</p>
          <p className="text-xs text-muted-foreground">
            {group.platform} · {group.seller}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Sem dados</p>
      )}
    </div>
  );
}