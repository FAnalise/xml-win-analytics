import { createFileRoute } from "@tanstack/react-router";
import { Coins, Percent, Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";

import {
  BreakdownChart,
  MonthlyChart,
  TopProductsChart,
} from "@/components/AnalyticsCharts";
import { AppLayout } from "@/components/AppLayout";
import { BreakdownTable } from "@/components/BreakdownTable";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { useSales } from "@/hooks/use-sales";
import { computeKpis } from "@/lib/aggregate";
import { brl, factor, pct, qty } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Price Analytics" },
      {
        name: "description",
        content:
          "Faturamento, lucro bruto, markup médio e ticket médio das vendas importadas das NF-e.",
      },
      { property: "og:title", content: "Dashboard — Price Analytics" },
      {
        property: "og:description",
        content: "Acompanhe faturamento, lucro e markup das suas vendas em tempo real.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: rows = [], isLoading } = useSales();
  const kpis = computeKpis(rows);

  return (
    <AppLayout title="Dashboard" description="Visão geral da lucratividade das vendas">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento" value={brl(kpis.revenue)} icon={Coins} />
        <StatCard label="Custo total" value={brl(kpis.cost)} icon={Wallet} />
        <StatCard
          label="Lucro bruto"
          value={brl(kpis.profit)}
          icon={TrendingUp}
          tone={kpis.profit >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Margem média" value={pct(kpis.margin)} icon={Percent} />
        <StatCard
          label="Markup médio"
          value={factor(kpis.avgMarkup)}
          hint="Venda ÷ custo"
          icon={Percent}
        />
        <StatCard label="Produtos vendidos" value={qty(kpis.units)} icon={ShoppingCart} />
        <StatCard label="Ticket médio" value={brl(kpis.avgTicket)} icon={Receipt} />
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando dados…</p>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <Panel title="Faturamento por mês" subtitle="Receita bruta das notas importadas">
            <MonthlyChart rows={rows} metric="revenue" />
          </Panel>
          <Panel title="Lucro por mês" subtitle="Receita menos custo dos produtos">
            <MonthlyChart rows={rows} metric="profit" />
          </Panel>
          <Panel title="Faturamento por plataforma" subtitle="Top 8 plataformas">
            <BreakdownChart rows={rows} dimension="platform" metric="value" />
          </Panel>
          <Panel title="Lucro por plataforma" subtitle="Lucro bruto por canal de venda">
            <BreakdownChart rows={rows} dimension="platform" metric="profit" />
          </Panel>
          <Panel title="Faturamento por vendedor" subtitle="Top 8 vendedores">
            <BreakdownChart rows={rows} dimension="seller" metric="value" />
          </Panel>
          <Panel title="Lucro por vendedor" subtitle="Lucro bruto por vendedor">
            <BreakdownChart rows={rows} dimension="seller" metric="profit" />
          </Panel>
          <Panel
            title="Detalhe por plataforma"
            subtitle="Faturamento, custo, lucro, markup e margem"
            className="xl:col-span-2"
          >
            <BreakdownTable rows={rows} dimension="platform" label="Plataforma" />
          </Panel>
          <Panel
            title="Detalhe por vendedor"
            subtitle="Faturamento, custo, lucro, markup e margem"
            className="xl:col-span-2"
          >
            <BreakdownTable rows={rows} dimension="seller" label="Vendedor" />
          </Panel>
          <Panel title="Produtos mais vendidos" subtitle="Top 8 por quantidade">
            <TopProductsChart rows={rows} metric="quantity" />
          </Panel>
          <Panel title="Produtos com maior lucro" subtitle="Top 8 por lucro bruto">
            <TopProductsChart rows={rows} metric="profit" />
          </Panel>
        </div>
      )}
    </AppLayout>
  );
}
