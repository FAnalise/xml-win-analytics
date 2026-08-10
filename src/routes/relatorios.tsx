import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSales } from "@/hooks/use-sales";
import { byMonth, byPlatform, bySeller, topProducts } from "@/lib/aggregate";
import { brl, monthLabel, qty } from "@/lib/format";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Price Analytics" },
      {
        name: "description",
        content: "Resumos por mês, plataforma, vendedor e produto, com exportação em CSV.",
      },
      { property: "og:title", content: "Relatórios — Price Analytics" },
      {
        property: "og:description",
        content: "Consolidados de faturamento e lucro prontos para exportar.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: rows = [] } = useSales();

  function exportCsv() {
    const header = [
      "Nota",
      "Data",
      "SKU",
      "Produto",
      "Quantidade",
      "Valor unitario",
      "Valor total",
      "Cliente",
      "Vendedor",
      "Plataforma",
      "Custo unitario",
      "Custo total",
      "Lucro",
      "Markup (x)",
      "Margem %",
    ];
    const body = rows.map((r) =>
      [
        r.invoiceNumber,
        r.date,
        r.sku,
        r.product.replace(/;/g, ","),
        r.quantity,
        r.unitValue,
        r.totalValue,
        r.customer.replace(/;/g, ","),
        r.seller.replace(/;/g, ","),
        r.platform,
        r.unitCost,
        r.totalCost,
        r.profit,
        r.markup === null ? "" : r.markup.toFixed(2),
        r.margin === null ? "" : r.margin.toFixed(2),
      ].join(";"),
    );
    const blob = new Blob([[header.join(";"), ...body].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "price-analytics-vendas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const months = byMonth(rows);
  const platforms = byPlatform(rows);
  const sellers = bySeller(rows);
  const products = topProducts(rows, "profit");

  return (
    <AppLayout
      title="Relatórios"
      description="Consolidados de faturamento e lucro"
      actions={
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Resumo mensal">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{monthLabel(m.month)}</TableCell>
                  <TableCell className="num text-right">{brl(m.revenue)}</TableCell>
                  <TableCell className="num text-right text-positive">{brl(m.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Por plataforma">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.map((p) => (
                <TableRow key={p.name}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="num text-right">{brl(p.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Ranking de vendedores">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((s) => (
                <TableRow key={s.name}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="num text-right">{brl(s.value)}</TableCell>
                  <TableCell className="num text-right">{brl(s.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Produtos mais lucrativos">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.sku}>
                  <TableCell className="max-w-[16rem] truncate">{p.name}</TableCell>
                  <TableCell className="num text-right">{qty(p.quantity)}</TableCell>
                  <TableCell className="num text-right text-positive">{brl(p.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </AppLayout>
  );
}