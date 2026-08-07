import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Price Analytics" },
      {
        name: "description",
        content: "Gerencie seu perfil e os dados importados das notas fiscais.",
      },
      { property: "og:title", content: "Configurações — Price Analytics" },
      {
        property: "og:description",
        content: "Perfil da conta e limpeza dos dados importados.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile.data?.full_name) setName(profile.data.full_name);
  }, [profile.data?.full_name]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, full_name: name, email: user!.email ?? null });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Perfil atualizado");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Não foi possível salvar o perfil"),
  });

  const wipe = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Notas e vendas removidas");
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível remover os dados"),
  });

  return (
    <AppLayout title="Configurações" description="Perfil e dados da conta">
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Perfil" subtitle="Informações da sua conta">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={user?.email ?? ""} readOnly disabled />
            </div>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              Salvar alterações
            </Button>
          </div>
        </Panel>

        <Panel title="Dados importados" subtitle="Remove todas as notas e itens importados">
          <p className="text-sm text-muted-foreground">
            Os custos cadastrados em Produtos são mantidos. Esta ação não pode ser desfeita.
          </p>
          <Button
            variant="destructive"
            className="mt-4"
            disabled={wipe.isPending}
            onClick={() => {
              if (window.confirm("Remover todas as notas fiscais importadas?")) wipe.mutate();
            }}
          >
            Limpar notas importadas
          </Button>
        </Panel>
      </div>
    </AppLayout>
  );
}