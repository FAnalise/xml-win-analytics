import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/Panel";
import type { SaleRow } from "@/hooks/use-sales";
import { breakdown } from "@/lib/aggregate";
import { brl, factor, pct } from "@/lib/format";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };
const grid = "var(--border)";
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};
const compact = (value: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function usePlatformData(rows: SaleRow[]) {
  return breakdown(rows, (r) => r.platform).map((g) => ({
    ...g,
    label: g.name.length > 18 ? `${g.name.slice(0, 18)}…` : g.name,
    markupValue: g.markup ?? 0,
    marginValue: g.margin ?? 0,
  }));
}

export function PlatformFinancialChart({ rows }: { rows: SaleRow[] }) {
  const data = usePlatformData(rows);
  if (data.length === 0) return <EmptyState message="Sem dados para os filtros selecionados." />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} {...axis} />
        <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={52} {...axis} />
        <Tooltip contentStyle={tooltipStyle} cursor={false} formatter={(v: number) => brl(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="value" name="Faturamento" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cost" name="Custo" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="profit" name="Lucro" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlatformMarkupChart({ rows }: { rows: SaleRow[] }) {
  const data = usePlatformData(rows);
  if (data.length === 0) return <EmptyState message="Sem dados para os filtros selecionados." />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} {...axis} />
        <YAxis
          yAxisId="mk"
          tickFormatter={(v: number) => `${v.toFixed(1)}x`}
          tickLine={false}
          axisLine={false}
          width={48}
          {...axis}
        />
        <YAxis
          yAxisId="mg"
          orientation="right"
          tickFormatter={(v: number) => `${Math.round(v)}%`}
          tickLine={false}
          axisLine={false}
          width={48}
          {...axis}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={false}
          formatter={(v: number, name) => (name === "Markup" ? factor(v) : pct(v))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="mk"
          dataKey="markupValue"
          name="Markup"
          fill="var(--chart-3)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="mg"
          dataKey="marginValue"
          name="Margem"
          fill="var(--chart-5)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
