import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { adminGetAiGlobalConfig, adminUpdateAiGlobalConfig } from "@/lib/ai-config.functions";

export const Route = createFileRoute("/_authenticated/admin/ai-config")({
  component: AiConfigPage,
});

const MODELS = [
  { v: "google/gemini-3-flash-preview", l: "Gemini 3 Flash (rápido, recomendado)" },
  { v: "google/gemini-2.5-flash", l: "Gemini 2.5 Flash" },
  { v: "google/gemini-2.5-flash-lite", l: "Gemini 2.5 Flash Lite (mais barato)" },
  { v: "google/gemini-2.5-pro", l: "Gemini 2.5 Pro (qualidade alta)" },
  { v: "openai/gpt-5-nano", l: "GPT-5 Nano (rápido)" },
  { v: "openai/gpt-5-mini", l: "GPT-5 Mini" },
  { v: "openai/gpt-5", l: "GPT-5 (qualidade máxima)" },
];

function AiConfigPage() {
  const get = useServerFn(adminGetAiGlobalConfig);
  const upd = useServerFn(adminUpdateAiGlobalConfig);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ai-global-config"], queryFn: () => get() });

  const [form, setForm] = useState({
    default_model: "google/gemini-3-flash-preview",
    master_system_prompt: "",
    default_temperature: 0.7,
    default_max_tokens: 500,
    enabled: true,
  });

  useEffect(() => {
    if (data) setForm({
      default_model: data.default_model,
      master_system_prompt: data.master_system_prompt,
      default_temperature: Number(data.default_temperature),
      default_max_tokens: data.default_max_tokens,
      enabled: data.enabled,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => upd({ data: form }),
    onSuccess: () => { toast.success("Configuração salva"); qc.invalidateQueries({ queryKey: ["ai-global-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p>Carregando…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração global da IA</CardTitle>
          <CardDescription>
            Define o modelo padrão e o "prompt mestre" usado em todas as respostas. Cada cliente pode
            sobrescrever modelo, temperatura e o próprio prompt — mas o mestre sempre é injetado primeiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded border p-4">
            <div>
              <p className="font-medium">IA ativa no sistema</p>
              <p className="text-sm text-muted-foreground">Quando desligada, nenhum cliente recebe resposta automática.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(c) => setForm({ ...form, enabled: c })} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>Modelo padrão</Label>
              <Select value={form.default_model} onValueChange={(v) => setForm({ ...form, default_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Modelos servidos pelo Lovable AI Gateway.</p>
            </div>
            <div>
              <Label>Max tokens</Label>
              <Input type="number" value={form.default_max_tokens}
                onChange={(e) => setForm({ ...form, default_max_tokens: parseInt(e.target.value || "0") })} />
            </div>
          </div>

          <div>
            <Label>Temperatura ({form.default_temperature.toFixed(2)})</Label>
            <input
              type="range" min={0} max={1.5} step={0.05}
              value={form.default_temperature}
              onChange={(e) => setForm({ ...form, default_temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Baixa = respostas previsíveis. Alta = mais criativas.</p>
          </div>

          <div>
            <Label>Prompt mestre (system)</Label>
            <Textarea
              rows={10}
              value={form.master_system_prompt}
              onChange={(e) => setForm({ ...form, master_system_prompt: e.target.value })}
              placeholder="Regras gerais que valem para todos os clientes…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Este texto é prefixado em todas as conversas. Use para regras de marca, idioma, restrições.
            </p>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
            {save.isPending ? "Salvando…" : "Salvar configuração"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
