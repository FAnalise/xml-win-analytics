import type { SaleRow } from "@/hooks/use-sales";

export type Kpis = {
  revenue: number;
  profit: number;
  avgMarkup: number | null;
  units: number;
  avgTicket: number;
  cost: number;
  margin: number | null;
};

export function computeKpis(rows: SaleRow[]): Kpis {
  const revenue = rows.reduce((s, r) => s + r.totalValue, 0);
  const cost = rows.reduce((s, r) => s + r.totalCost, 0);
  const units = rows.reduce((s, r) => s + r.quantity, 0);
  const withCost = rows.filter((r) => r.markup !== null);
  const costed = withCost.reduce((s, r) => s + r.totalCost, 0);
  const costedRevenue = withCost.reduce((s, r) => s + r.totalValue, 0);
  const invoices = new Set(rows.map((r) => r.invoiceNumber)).size;
  return {
    revenue,
    profit: revenue - cost,
    avgMarkup: costed > 0 ? ((costedRevenue - costed) / costed) * 100 : null,
    units,
    avgTicket: invoices > 0 ? revenue / invoices : 0,
    cost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
  };
}

function groupSum<T extends string>(
  rows: SaleRow[],
  key: (row: SaleRow) => T,
  value: (row: SaleRow) => number,
) {
  const map = new Map<T, number>();
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + value(row));
  return map;
}

export function byMonth(rows: SaleRow[]) {
  const revenue = groupSum(
    rows,
    (r) => r.date.slice(0, 7),
    (r) => r.totalValue,
  );
  const profit = groupSum(
    rows,
    (r) => r.date.slice(0, 7),
    (r) => r.profit,
  );
  return [...revenue.keys()]
    .sort()
    .map((month) => ({
      month,
      revenue: revenue.get(month) ?? 0,
      profit: profit.get(month) ?? 0,
    }));
}

export function byPlatform(rows: SaleRow[]) {
  return [...groupSum(
    rows,
    (r) => r.platform,
    (r) => r.totalValue,
  )]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function bySeller(rows: SaleRow[]) {
  const revenue = groupSum(
    rows,
    (r) => r.seller,
    (r) => r.totalValue,
  );
  const profit = groupSum(
    rows,
    (r) => r.seller,
    (r) => r.profit,
  );
  return [...revenue]
    .map(([name, value]) => ({ name, value, profit: profit.get(name) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function topProducts(rows: SaleRow[], metric: "quantity" | "profit") {
  const map = new Map<string, { name: string; quantity: number; profit: number }>();
  for (const row of rows) {
    const current = map.get(row.sku) ?? { name: row.product, quantity: 0, profit: 0 };
    current.quantity += row.quantity;
    current.profit += row.profit;
    map.set(row.sku, current);
  }
  return [...map.entries()]
    .map(([sku, v]) => ({ sku, ...v }))
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 8);
}