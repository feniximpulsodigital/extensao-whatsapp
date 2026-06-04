import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

type Provider = "groq" | "openai" | "anthropic";

const MODELS: Record<Provider, { v: string; l: string }[]> = {
  groq: [
    { v: "llama-3.3-70b-versatile", l: "Llama 3.3 70B (recomendado)" },
    { v: "llama-3.1-8b-instant", l: "Llama 3.1 8B (mais rápido/barato)" },
    { v: "openai/gpt-oss-120b", l: "GPT-OSS 120B" },
    { v: "moonshotai/kimi-k2-instruct", l: "Kimi K2 Instruct" },
  ],
  openai: [
    { v: "gpt-4o-mini", l: "GPT-4o mini (barato e rápido)" },
    { v: "gpt-4o", l: "GPT-4o" },
    { v: "gpt-4.1-mini", l: "GPT-4.1 mini" },
    { v: "gpt-4.1", l: "GPT-4.1" },
  ],
  anthropic: [
    { v: "claude-haiku-4-5", l: "Claude Haiku 4.5 (barato e rápido)" },
    { v: "claude-sonnet-4-5", l: "Claude Sonnet 4.5 (recomendado)" },
    { v: "claude-opus-4-5", l: "Claude Opus 4.5 (qualidade máxima)" },
  ],
};

const PROVIDER_SECRET: Record<Provider, string> = {
  groq: "GROQ_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

function AiConfigPage() {
  const get = useServerFn(adminGetAiGlobalConfig);
  const upd = useServerFn(adminUpdateAiGlobalConfig);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ai-global-config"], queryFn: () => get() });

  const [form, setForm] = useState({
    provider: "groq" as Provider,
    default_model: "llama-3.3-70b-versatile",
    master_system_prompt: "",
    default_temperature: 0.7,
    default_max_tokens: 500,
    default_monthly_usd: 5,
    enabled: true,
  });

  useEffect(() => {
    if (data) setForm({
      provider: (data.provider as Provider) ?? "groq",
      default_model: data.default_model,
      master_system_prompt: data.master_system_prompt,
      default_temperature: Number(data.default_temperature),
      default_max_tokens: data.default_max_tokens,
      default_monthly_usd: Number((data as any).default_monthly_usd ?? 5),
      enabled: data.enabled,
    });
  }, [data]);

  const modelOptions = useMemo(() => MODELS[form.provider] ?? [], [form.provider]);

  const save = useMutation({
    mutationFn: () => upd({ data: form }),
    onSuccess: () => { toast.success("Configuração salva"); qc.invalidateQueries({ queryKey: ["ai-global-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p>Carregando…</p>;

  const onProviderChange = (p: Provider) => {
    const first = MODELS[p][0]?.v ?? "";
    setForm((f) => ({ ...f, provider: p, default_model: first }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração global da IA</CardTitle>
          <CardDescription>
            Escolha o provedor (Groq, OpenAI/GPT ou Anthropic/Claude), o modelo padrão e o prompt mestre
            aplicado a todos os clientes. Esta tela é visível apenas para administradores.
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
            <div>
              <Label>Provedor</Label>
              <Select value={form.provider} onValueChange={(v) => onProviderChange(v as Provider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Requer o secret <code>{PROVIDER_SECRET[form.provider]}</code> configurado.
              </p>
            </div>
            <div className="md:col-span-2">
              <Label>Modelo padrão</Label>
              <Select value={form.default_model} onValueChange={(v) => setForm({ ...form, default_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Max tokens</Label>
              <Input type="number" value={form.default_max_tokens}
                onChange={(e) => setForm({ ...form, default_max_tokens: parseInt(e.target.value || "0") })} />
            </div>
            <div>
              <Label>Temperatura ({form.default_temperature.toFixed(2)})</Label>
              <input
                type="range" min={0} max={1.5} step={0.05}
                value={form.default_temperature}
                onChange={(e) => setForm({ ...form, default_temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label>Crédito mensal padrão (USD) — interno</Label>
              <Input
                type="number" step="0.5" min={0}
                value={form.default_monthly_usd}
                onChange={(e) => setForm({ ...form, default_monthly_usd: parseFloat(e.target.value || "0") })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Convertido em créditos para cada cliente novo. Não aparece para o cliente.
              </p>
            </div>
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
              Prefixado em todas as conversas. Use para regras de marca, idioma e restrições.
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
