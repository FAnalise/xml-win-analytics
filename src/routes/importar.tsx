import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { parseNfeXml } from "@/lib/nfe";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar XML — Price Analytics" },
      {
        name: "description",
        content: "Envie um ou vários XMLs de NF-e do Tiny/Olist e salve as vendas automaticamente.",
      },
      { property: "og:title", content: "Importar XML — Price Analytics" },
      {
        property: "og:description",
        content: "Upload em lote de notas fiscais eletrônicas com progresso em tempo real.",
      },
    ],
  }),
  component: ImportPage,
});

type Result = { file: string; ok: boolean; message: string };

function ImportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [dragging, setDragging] = useState(false);

  async function importFiles(files: File[]) {
    if (!user || files.length === 0) return;
    setRunning(true);
    setResults([]);
    setProgress(0);
    const collected: Result[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!;
      try {
        const parsed = parseNfeXml(await file.text());

        if (parsed.accessKey) {
          const { data: existing } = await supabase
            .from("invoices")
            .select("id")
            .eq("access_key", parsed.accessKey)
            .maybeSingle();
          if (existing) {
            collected.push({ file: file.name, ok: false, message: "Nota já importada" });
            setProgress(Math.round(((index + 1) / files.length) * 100));
            setResults([...collected]);
            continue;
          }
        }

        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            user_id: user.id,
            number: parsed.number,
            access_key: parsed.accessKey,
            issue_date: parsed.issueDate,
            customer: parsed.customer,
            seller: parsed.seller,
            platform: parsed.platform,
            total: parsed.total,
          })
          .select("id")
          .single();
        if (invoiceError) throw invoiceError;

        const { error: itemsError } = await supabase.from("invoice_items").insert(
          parsed.items.map((item) => ({
            user_id: user.id,
            invoice_id: invoice.id,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit_value: item.unitValue,
            total_value: item.totalValue,
          })),
        );
        if (itemsError) throw itemsError;

        const uniqueProducts = new Map(parsed.items.map((i) => [i.sku, i.description]));
        await supabase.from("products").upsert(
          [...uniqueProducts].map(([sku, name]) => ({ user_id: user.id, sku, name })),
          { onConflict: "user_id,sku", ignoreDuplicates: true },
        );

        collected.push({
          file: file.name,
          ok: true,
          message: `NF ${parsed.number} • ${parsed.items.length} item(ns)`,
        });
      } catch (error) {
        collected.push({
          file: file.name,
          ok: false,
          message: error instanceof Error ? error.message : "Falha ao importar",
        });
      }
      setProgress(Math.round(((index + 1) / files.length) * 100));
      setResults([...collected]);
    }

    setRunning(false);
    await queryClient.invalidateQueries();
    const success = collected.filter((r) => r.ok).length;
    toast.success(`${success} de ${files.length} nota(s) importada(s)`);
  }

  return (
    <AppLayout title="Importar XML" description="Notas fiscais eletrônicas do Tiny/Olist">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Upload de notas" subtitle="Selecione um ou vários arquivos .xml">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void importFiles(
                Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".xml")),
              );
            }}
            className={`grid place-items-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <FileUp className="size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Arraste os XMLs aqui</p>
            <p className="mt-1 text-xs text-muted-foreground">ou selecione os arquivos manualmente</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              multiple
              className="hidden"
              onChange={(e) => {
                void importFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <Button
              className="mt-5"
              disabled={running}
              onClick={() => inputRef.current?.click()}
            >
              {running ? "Importando…" : "Escolher arquivos"}
            </Button>
          </div>

          {(running || progress > 0) && (
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>Progresso da importação</span>
                <span className="num">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </Panel>

        <Panel title="Resultado" subtitle="Detalhe por arquivo processado">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo processado nesta sessão.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((result, i) => (
                <li
                  key={`${result.file}-${i}`}
                  className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5"
                >
                  {result.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 text-positive" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 text-negative" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{result.file}</p>
                    <p className="text-xs text-muted-foreground">{result.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppLayout>
  );
}