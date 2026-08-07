import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/Panel";
import type { SaleRow } from "@/hooks/use-sales";
import { byMonth, byPlatform, bySeller, topProducts } from "@/lib/aggregate";
import { brl, monthLabel, qty } from "@/lib/format";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };
const grid = "var(--border)";
const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

const compact = (value: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function MonthlyChart({ rows, metric }: { rows: SaleRow[]; metric: "revenue" | "profit" }) {
  const data = byMonth(rows).map((d) => ({ ...d, label: monthLabel(d.month) }));
  if (data.length === 0) return <EmptyState message="Importe notas para ver a evolução mensal." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} {...axis} />
        <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} {...axis} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => brl(v)} />
        <Line
          type="monotone"
          dataKey={metric}
          name={metric === "revenue" ? "Faturamento" : "Lucro"}
          stroke={metric === "revenue" ? "var(--chart-2)" : "var(--chart-1)"}
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PlatformChart({ rows }: { rows: SaleRow[] }) {
  const data = byPlatform(rows);
  if (data.length === 0) return <EmptyState message="Sem vendas por plataforma ainda." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => brl(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SellerChart({ rows }: { rows: SaleRow[] }) {
  const data = bySeller(rows);
  if (data.length === 0) return <EmptyState message="Sem vendedores identificados." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" tickFormatter={compact} tickLine={false} axisLine={false} {...axis} />
        <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} {...axis} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => brl(v)} cursor={false} />
        <Bar dataKey="value" name="Faturamento" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({
  rows,
  metric,
}: {
  rows: SaleRow[];
  metric: "quantity" | "profit";
}) {
  const data = topProducts(rows, metric).map((p) => ({
    ...p,
    label: p.name.length > 22 ? `${p.name.slice(0, 22)}…` : p.name,
  }));
  if (data.length === 0) return <EmptyState message="Sem produtos vendidos ainda." />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16 }}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" tickFormatter={compact} tickLine={false} axisLine={false} {...axis} />
        <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} {...axis} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={false}
          formatter={(v: number) => (metric === "profit" ? brl(v) : qty(v))}
        />
        <Bar
          dataKey={metric}
          name={metric === "profit" ? "Lucro" : "Quantidade"}
          fill={metric === "profit" ? "var(--chart-1)" : "var(--chart-3)"}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}