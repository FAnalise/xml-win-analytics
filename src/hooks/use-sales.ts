import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  unit_cost: number;
  updated_at: string;
};

export type SaleRow = {
  id: string;
  invoiceNumber: string;
  date: string;
  sku: string;
  product: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  customer: string;
  seller: string;
  platform: string;
  unitCost: number;
  totalCost: number;
  profit: number;
  markup: number | null;
};

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, unit_cost, updated_at")
        .order("sku");
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, unit_cost: Number(row.unit_cost) }));
    },
  });
}

export function useSales() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: async (): Promise<SaleRow[]> => {
      const [invoicesRes, itemsRes, productsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, number, issue_date, customer, seller, platform")
          .order("issue_date", { ascending: false }),
        supabase
          .from("invoice_items")
          .select("id, invoice_id, sku, description, quantity, unit_value, total_value"),
        supabase.from("products").select("sku, unit_cost"),
      ]);
      if (invoicesRes.error) throw invoicesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (productsRes.error) throw productsRes.error;

      const invoices = new Map((invoicesRes.data ?? []).map((inv) => [inv.id, inv]));
      const costs = new Map(
        (productsRes.data ?? []).map((p) => [p.sku, Number(p.unit_cost) || 0]),
      );

      const rows: SaleRow[] = [];
      for (const item of itemsRes.data ?? []) {
        const invoice = invoices.get(item.invoice_id);
        if (!invoice) continue;
        const quantity = Number(item.quantity) || 0;
        const unitValue = Number(item.unit_value) || 0;
        const totalValue = Number(item.total_value) || 0;
        const unitCost = costs.get(item.sku) ?? 0;
        const totalCost = unitCost * quantity;
        const profit = totalValue - totalCost;
        rows.push({
          id: item.id,
          invoiceNumber: invoice.number,
          date: invoice.issue_date,
          sku: item.sku,
          product: item.description,
          quantity,
          unitValue,
          totalValue,
          customer: invoice.customer,
          seller: invoice.seller,
          platform: invoice.platform,
          unitCost,
          totalCost,
          profit,
          markup: unitCost > 0 ? ((unitValue - unitCost) / unitCost) * 100 : null,
        });
      }
      rows.sort((a, b) => (a.date < b.date ? 1 : -1));
      return rows;
    },
  });
}