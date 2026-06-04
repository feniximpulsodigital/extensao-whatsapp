import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bot, LogOut, ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyAiConfig, updateMyAiConfig,
  listMyKnowledge, upsertMyKnowledge, deleteMyKnowledge,
} from "@/lib/ai-config.functions";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [{ title: "Minha IA — Argos" }] }),
  component: AiPage,
});

function AiPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getCfg = useServerFn(getMyAiConfig);
  const updCfg = useServerFn(updateMyAiConfig);
  const listKB = useServerFn(listMyKnowledge);
  const upsertKB = useServerFn(upsertMyKnowledge);
  const delKB = useServerFn(deleteMyKnowledge);

  const { data: cfg } = useQuery({ queryKey: ["my-ai-config"], queryFn: () => getCfg() });
  const { data: kb } = useQuery({ queryKey: ["my-kb"], queryFn: () => listKB() });

  const [form, setForm] = useState({
    model: "",
    temperature: 0.7,
    max_tokens: 500,
    auto_reply_enabled: false,
    response_delay_ms: 1500,
    prompt_content: "",
  });
  useEffect(() => {
    if (cfg?.config) {
      const c = cfg.config;
      setForm((f) => ({
        ...f,
        model: c.model ?? "",
        temperature: Number(c.temperature ?? 0.7),
        max_tokens: c.max_tokens ?? 500,
        auto_reply_enabled: c.auto_reply_enabled ?? false,
        response_delay_ms: c.response_delay_ms ?? 1500,
        prompt_content: cfg.prompt?.content ?? "",
      }));
    }
  }, [cfg]);

  const save = useMutation({
    mutationFn: () => updCfg({ data: {
      model: form.model || undefined,
      temperature: form.temperature,
      max_tokens: form.max_tokens,
      auto_reply_enabled: form.auto_reply_enabled,
      response_delay_ms: form.response_delay_ms,
      prompt_content: form.prompt_content || undefined,
    }}),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["my-ai-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const saveKB = useMutation({
    mutationFn: () => upsertKB({ data: {
      id: editing.id || undefined,
      question: editing.question, answer: editing.answer,
      tags: editing.tags ?? [], is_active: editing.is_active ?? true,
    }}),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["my-kb"] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeKB = useMutation({
    mutationFn: (id: string) => delKB({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["my-kb"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-bold">Argos</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link></Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              const { invalidateAuthGate } = await import("./route");
              invalidateAuthGate();
              await supabase.auth.signOut();
              navigate({ to: "/login", replace: true });
            }}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">Minha IA</h1>
          <p className="text-muted-foreground">Personalize como sua IA responde no WhatsApp.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configurações da resposta</CardTitle>
            <CardDescription>Deixe em branco para usar os padrões globais do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded border p-4">
              <div>
                <p className="font-medium">Resposta automática</p>
                <p className="text-sm text-muted-foreground">Quando ligada, a IA responde mensagens recebidas sem intervenção.</p>
              </div>
              <Switch checked={form.auto_reply_enabled} onCheckedChange={(c) => setForm({ ...form, auto_reply_enabled: c })} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Modelo (opcional)</Label>
                <Input placeholder="usar padrão do sistema" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div>
                <Label>Max tokens</Label>
                <Input type="number" value={form.max_tokens} onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value || "0") })} />
              </div>
              <div>
                <Label>Delay antes de responder (ms)</Label>
                <Input type="number" value={form.response_delay_ms} onChange={(e) => setForm({ ...form, response_delay_ms: parseInt(e.target.value || "0") })} />
              </div>
            </div>

            <div>
              <Label>Temperatura ({form.temperature.toFixed(2)})</Label>
              <input type="range" min={0} max={1.5} step={0.05} value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })} className="w-full" />
            </div>

            <div>
              <Label>Prompt da minha empresa</Label>
              <Textarea rows={8} value={form.prompt_content}
                onChange={(e) => setForm({ ...form, prompt_content: e.target.value })}
                placeholder="Ex.: Você é o atendente virtual da Padaria do João. Seja sempre cordial, ofereça opções de delivery e horário de funcionamento (8h-20h). Não invente preços que não estejam na base de conhecimento." />
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Base de conhecimento</CardTitle>
                <CardDescription>Perguntas e respostas que a IA consulta antes de responder.</CardDescription>
              </div>
              <Button onClick={() => setEditing({ question: "", answer: "", tags: [], is_active: true })}>
                <Plus className="h-4 w-4 mr-2" />Nova entrada
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(kb ?? []).length === 0 && <p className="text-muted-foreground text-sm">Nenhuma entrada cadastrada.</p>}
            {(kb ?? []).map((k: any) => (
              <div key={k.id} className="border rounded p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{k.question}</p>
                    {!k.is_active && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{k.answer}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(k)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) removeKB.mutate(k.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar entrada" : "Nova entrada"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Pergunta / gatilho</Label><Input value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} /></div>
              <div><Label>Resposta</Label><Textarea rows={6} value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(c) => setEditing({ ...editing, is_active: c })} />
                <Label>Ativo</Label>
              </div>
              <DialogFooter>
                <Button onClick={() => saveKB.mutate()} disabled={saveKB.isPending || !editing.question || !editing.answer}>
                  {saveKB.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
