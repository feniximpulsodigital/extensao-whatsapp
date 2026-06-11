import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LogOut, Settings, AlertTriangle, Zap, Plus, Pencil, Trash2, Download, FileText, Upload } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyCreditsSummary } from "@/lib/ai-credits.functions";
import { getMyExtensionApiKey } from "@/lib/billing.functions";
import { buildMyExtension } from "@/lib/extension-builder.functions";
import {
  getMyAiConfig, updateMyAiConfig,
  listMyKnowledge, upsertMyKnowledge, deleteMyKnowledge,
  listMyKnowledgeFiles, uploadMyKnowledgeFile, toggleMyKnowledgeFile, deleteMyKnowledgeFile,
} from "@/lib/ai-config.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Argos" }] }),
  component: Dashboard,
  errorComponent: ({ error }) => <div className="p-6">Erro: {error.message}</div>,
});

function Dashboard() {
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const summary = useServerFn(getMyCreditsSummary);
  const extKeyFn = useServerFn(getMyExtensionApiKey);
  const buildExt = useServerFn(buildMyExtension);

  const { data: tenant } = useQuery({
    queryKey: ["my-tenant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, status, credits_balance, plan_id, plans(name)")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: credits } = useQuery({ queryKey: ["credits-summary"], queryFn: () => summary() });
  const { data: extKey } = useQuery({ queryKey: ["extension-key"], queryFn: () => extKeyFn() });

  const downloadExt = useMutation({
    mutationFn: async () => buildExt({ data: { origin: window.location.origin } }),
    onSuccess: (res) => {
      const bin = atob(res.base64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const blob = new Blob([u8], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Extensão baixada! Siga as instruções do README.txt para instalar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleLogout = async () => {
    const { invalidateAuthGate } = await import("./route");
    invalidateAuthGate();
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const showAi = !isAdmin && !!tenant?.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center">
            <Logo size={32} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/settings"><Settings className="h-4 w-4 mr-2" />Admin</Link>
              </Button>
            )}
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="h-4 w-4 mr-2" />Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Olá, {user.email}</h1>
          <p className="text-muted-foreground">Seu painel Argos</p>
        </div>

        {credits?.lowBalance && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold">Saldo baixo</p>
                  <p className="text-sm text-muted-foreground">
                    Você usou {100 - credits.pctRemaining}% da sua cota. Compre mais para não interromper o uso.
                  </p>
                </div>
              </div>
              <Button asChild><Link to="/buy-credits">Comprar créditos</Link></Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Créditos disponíveis</CardDescription>
              <CardTitle className="text-3xl">{credits?.balance ?? tenant?.credits_balance ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              {credits && credits.allowance > 0 && (
                <>
                  <Progress value={credits.pctRemaining} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">{credits.pctRemaining}% restante de {credits.allowance}/mês</p>
                </>
              )}
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link to="/buy-credits"><Zap className="h-4 w-4 mr-2" />Comprar mais</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Plano</CardDescription>
              <CardTitle className="text-xl">{tenant?.plans?.name ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-xl capitalize">{tenant?.status ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sua extensão personalizada</CardTitle>
            <CardDescription>
              Baixe sua extensão exclusiva — já vem com sua chave embutida.
              Pode instalar em quantos computadores quiser; a IA funciona enquanto
              pelo menos um deles estiver com o Chrome aberto no WhatsApp Web.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => downloadExt.mutate()} disabled={downloadExt.isPending} size="lg">
              <Download className="h-4 w-4 mr-2" />
              {downloadExt.isPending ? "Gerando…" : "Baixar minha extensão (.zip)"}
            </Button>
            <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
              <li>Descompacte o arquivo baixado.</li>
              <li>Abra <code className="px-1 bg-muted rounded">chrome://extensions</code> no Chrome.</li>
              <li>Ative o <b>Modo do desenvolvedor</b> (canto superior direito).</li>
              <li>Clique em <b>Carregar sem compactação</b> e selecione a pasta descompactada.</li>
              <li>Abra <b>web.whatsapp.com</b> e clique no ícone da extensão para ativar.</li>
            </ol>
            {extKey?.extensionApiKey && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Ver chave de API (uso avançado)</summary>
                <code className="block mt-2 rounded bg-muted p-2 break-all">{extKey.extensionApiKey}</code>
              </details>
            )}
          </CardContent>
        </Card>

        {showAi && <AiSection />}
      </main>
    </div>
  );
}

function AiSection() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getMyAiConfig);
  const updCfg = useServerFn(updateMyAiConfig);
  const listKB = useServerFn(listMyKnowledge);
  const upsertKB = useServerFn(upsertMyKnowledge);
  const delKB = useServerFn(deleteMyKnowledge);

  const { data: cfg } = useQuery({ queryKey: ["my-ai-config"], queryFn: () => getCfg() });
  const { data: kb } = useQuery({ queryKey: ["my-kb"], queryFn: () => listKB() });

  const [form, setForm] = useState({
    temperature: 0.7,
    max_tokens: 500,
    prompt_content: "",
  });
  useEffect(() => {
    if (cfg?.config) {
      const c: any = cfg.config;
      setForm((f) => ({
        ...f,
        temperature: Number(c.temperature ?? 0.7),
        max_tokens: c.max_tokens ?? 500,
        prompt_content: cfg.prompt?.content ?? "",
      }));
    }
  }, [cfg]);

  const save = useMutation({
    mutationFn: () => updCfg({ data: {
      temperature: form.temperature,
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

  // ---- arquivos de conhecimento ----
  const listFiles = useServerFn(listMyKnowledgeFiles);
  const uploadFile = useServerFn(uploadMyKnowledgeFile);
  const toggleFile = useServerFn(toggleMyKnowledgeFile);
  const delFile = useServerFn(deleteMyKnowledgeFile);
  const { data: files } = useQuery({ queryKey: ["my-kb-files"], queryFn: () => listFiles() });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 4MB)."); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = () => rej(new Error("Falha ao ler o arquivo"));
        r.readAsDataURL(file);
      });
      const out = await uploadFile({ data: { filename: file.name, base64 } });
      toast.success(`Arquivo adicionado (${out.chars.toLocaleString("pt-BR")} caracteres extraídos)`);
      qc.invalidateQueries({ queryKey: ["my-kb-files"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const togFile = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFile({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-kb-files"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const remFile = useMutation({
    mutationFn: (id: string) => delFile({ data: { id } }),
    onSuccess: () => { toast.success("Arquivo removido"); qc.invalidateQueries({ queryKey: ["my-kb-files"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Minha IA</CardTitle>
          <CardDescription>Personalize como sua IA responde no WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Criatividade da IA ({form.temperature.toFixed(2)})</Label>
            <input type="range" min={0} max={1.5} step={0.05} value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })} className="w-full" />
            <p className="text-xs text-muted-foreground mt-1">
              Controla a liberdade da IA. O ideal para atendimento é <strong>0.7 = equilibrado</strong>. <strong>1.0+ = mais criativo, mas pode inventar</strong>.
            </p>
          </div>


          <div>
            <Label>Prompt da minha empresa</Label>
            <Textarea rows={6} value={form.prompt_content}
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Arquivos de conhecimento</CardTitle>
              <CardDescription>Envie documentos (PDF, TXT, MD, CSV) — a IA usa o conteúdo deles para responder.</CardDescription>
            </div>
            <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />{uploading ? "Enviando…" : "Enviar arquivo"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv" className="hidden" onChange={onPickFile} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              Arquivos aumentam o consumo de créditos
            </p>
            <p className="text-muted-foreground mt-1">
              O conteúdo dos arquivos <strong>ativos</strong> é enviado junto com <strong>cada resposta</strong> da IA,
              o que aumenta o custo em créditos por mensagem — quanto mais texto ativo, maior o consumo.
              Mantenha ativos apenas os arquivos realmente necessários e prefira documentos enxutos.
              Você pode desativar um arquivo a qualquer momento sem excluí-lo.
            </p>
          </div>
          {(files ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhum arquivo enviado. Até 10 arquivos de no máximo 4MB cada.</p>
          )}
          {(files ?? []).map((f: any) => (
            <div key={f.id} className="border rounded p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{f.filename}</p>
                  <p className="text-xs text-muted-foreground">{Number(f.char_count).toLocaleString("pt-BR")} caracteres extraídos</p>
                </div>
                {!f.is_active && <Badge variant="secondary">inativo</Badge>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={f.is_active} onCheckedChange={(c) => togFile.mutate({ id: f.id, is_active: c })} />
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover arquivo?")) remFile.mutate(f.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
    </>
  );
}
