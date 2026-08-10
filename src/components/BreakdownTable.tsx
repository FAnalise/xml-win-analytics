import { EmptyState } from "@/components/Panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SaleRow } from "@/hooks/use-sales";
import { breakdown } from "@/lib/aggregate";
import { brl, factor, pct, qty } from "@/lib/format";

export function BreakdownTable({
  rows,
  dimension,
  label,
}: {
  rows: SaleRow[];
  dimension: "platform" | "seller";
  label: string;
}) {
  const data = breakdown(rows, (r) => (dimension === "platform" ? r.platform : r.seller));
  if (data.length === 0) return <EmptyState message="Sem dados para este agrupamento." />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{label}</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Faturamento</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">Lucro</TableHead>
            <TableHead className="text-right">Markup</TableHead>
            <TableHead className="text-right">Margem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((g) => (
            <TableRow key={g.name}>
              <TableCell className="max-w-[14rem] truncate">{g.name}</TableCell>
              <TableCell className="num text-right">{qty(g.units)}</TableCell>
              <TableCell className="num text-right">{brl(g.value)}</TableCell>
              <TableCell className="num text-right">{brl(g.cost)}</TableCell>
              <TableCell
                className={`num text-right ${g.profit >= 0 ? "text-positive" : "text-negative"}`}
              >
                {brl(g.profit)}
              </TableCell>
              <TableCell className="num text-right">{factor(g.markup)}</TableCell>
              <TableCell className="num text-right">{pct(g.margin)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}