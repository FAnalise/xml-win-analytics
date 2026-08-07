import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Panel } from "@/components/Panel";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProducts } from "@/hooks/use-sales";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Price Analytics" },
      {
        name: "description",
        content: "Cadastre e atualize o custo unitário de cada SKU importado das notas fiscais.",
      },
      { property: "og:title", content: "Produtos — Price Analytics" },
      {
        property: "og:description",
        content: "Custo unitário por SKU com histórico de última atualização.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const saveCost = useMutation({
    mutationFn: async ({ id, cost }: { id: string; cost: number }) => {
      const { error } = await supabase.from("products").update({ unit_cost: cost }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Custo atualizado");
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível salvar o custo"),
  });

  const term = search.trim().toLowerCase();
  const filtered = products.filter(
    (p) => !term || p.sku.toLowerCase().includes(term) || p.name.toLowerCase().includes(term),
  );

  return (
    <AppLayout title="Produtos" description="Custo unitário por SKU">
      <Panel title="Catálogo" subtitle={`${products.length} produto(s) cadastrado(s)`}>
        <Input
          placeholder="Buscar por SKU ou descrição"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-48">Custo unitário</TableHead>
                <TableHead className="w-44">Última atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum produto. Importe XMLs para popular o catálogo.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((product) => {
                  const draft = drafts[product.id];
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="num text-xs">{product.sku}</TableCell>
                      <TableCell className="max-w-md truncate">{product.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="num h-9 w-36"
                          value={draft ?? String(product.unit_cost)}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [product.id]: e.target.value }))
                          }
                          onBlur={() => {
                            if (draft === undefined) return;
                            const cost = Number(draft.replace(",", "."));
                            setDrafts((prev) => {
                              const next = { ...prev };
                              delete next[product.id];
                              return next;
                            });
                            if (!Number.isFinite(cost) || cost === product.unit_cost) return;
                            saveCost.mutate({ id: product.id, cost });
                          }}
                        />
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {brl(product.unit_cost)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(product.updated_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </AppLayout>
  );
}