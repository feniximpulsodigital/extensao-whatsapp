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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  LogOut,
  Settings,
  AlertTriangle,
  Zap,
  Plus,
  Pencil,
  Trash2,
  Download,
  FileText,
  Upload,
  Smartphone,
  LifeBuoy,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyCreditsSummary } from "@/lib/ai-credits.functions";
import {
  getMyExtensionApiKey,
  addMyWhatsappNumber,
  removeMyWhatsappNumber,
} from "@/lib/billing.functions";
import { getMySupportBadge, getMyRefundEligibility, requestRefund } from "@/lib/support.functions";
import {
  getPlanChangeOptions,
  scheduleDowngrade,
  cancelScheduledDowngrade,
} from "@/lib/plan-change.functions";
import { buildMyExtension } from "@/lib/extension-builder.functions";
import {
  getMyAiConfig,
  updateMyAiConfig,
  listMyKnowledge,
  upsertMyKnowledge,
  deleteMyKnowledge,
  listMyKnowledgeFiles,
  uploadMyKnowledgeFile,
  toggleMyKnowledgeFile,
  deleteMyKnowledgeFile,
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
        .select(
          "id, status, credits_balance, plan_id, whatsapp_numbers, plans!tenants_plan_id_fkey(name, max_devices, max_numbers)",
        )
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: credits } = useQuery({ queryKey: ["credits-summary"], queryFn: () => summary() });
  const { data: extKey } = useQuery({ queryKey: ["extension-key"], queryFn: () => extKeyFn() });

  // Notificação de resposta do suporte: badge no botão + toast quando chega
  const supportBadgeFn = useServerFn(getMySupportBadge);
  const { data: supportBadge } = useQuery({
    queryKey: ["support-badge"],
    queryFn: () => supportBadgeFn(),
    enabled: !isAdmin,
    refetchInterval: 30_000,
  });
  const prevUnread = useRef<number | null>(null);
  useEffect(() => {
    const unread = supportBadge?.unread;
    if (unread === undefined) return;
    if (prevUnread.current !== null && unread > prevUnread.current) {
      toast.info("O suporte respondeu seu ticket. Veja em Suporte.");
    }
    prevUnread.current = unread;
  }, [supportBadge?.unread]);

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
            {!isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/support">
                  <LifeBuoy className="h-4 w-4 mr-1" />
                  Suporte
                  {(supportBadge?.unread ?? 0) > 0 && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                      {supportBadge!.unread}
                    </span>
                  )}
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Link>
              </Button>
            )}
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
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
                    Você usou {100 - credits.pctRemaining}% da sua cota. Compre mais para não
                    interromper o uso.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/buy-credits">Comprar créditos</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Créditos disponíveis</CardDescription>
              <CardTitle className="text-3xl">
                {credits?.balance ?? tenant?.credits_balance ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {credits && credits.allowance > 0 && (
                <>
                  <Progress value={credits.pctRemaining} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {credits.pctRemaining}% restante de {credits.allowance}/mês
                  </p>
                </>
              )}
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link to="/buy-credits">
                  <Zap className="h-4 w-4 mr-2" />
                  Comprar mais
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Plano</CardDescription>
              <CardTitle className="text-xl">{tenant?.plans?.name ?? "—"}</CardTitle>
              {tenant?.plans?.max_devices ? (
                <p className="text-xs text-muted-foreground">
                  Até {tenant.plans.max_devices} computador
                  {tenant.plans.max_devices > 1 ? "es" : ""} ativo
                  {tenant.plans.max_devices > 1 ? "s" : ""} por vez
                </p>
              ) : null}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-xl capitalize">{tenant?.status ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {!isAdmin && tenant?.status === "active" && <PlanCard />}

        {!isAdmin && tenant?.status === "active" && <RefundCard />}

        {!isAdmin && tenant && (
          <WhatsappNumbersCard
            numbers={tenant.whatsapp_numbers ?? []}
            maxNumbers={tenant.plans?.max_numbers ?? null}
            onSaved={() => qc.invalidateQueries({ queryKey: ["my-tenant"] })}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Sua extensão personalizada</CardTitle>
            <CardDescription>
              Baixe sua extensão exclusiva — já vem com sua chave embutida. Conforme o seu plano,
              instale em um ou mais computadores; a IA funciona enquanto pelo menos um deles estiver
              com o Chrome aberto no WhatsApp Web do número cadastrado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => downloadExt.mutate()} disabled={downloadExt.isPending} size="lg">
              <Download className="h-4 w-4 mr-2" />
              {downloadExt.isPending ? "Gerando…" : "Baixar minha extensão (.zip)"}
            </Button>
            <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
              <li>Descompacte o arquivo baixado.</li>
              <li>
                Abra <code className="px-1 bg-muted rounded">chrome://extensions</code> no Chrome.
              </li>
              <li>
                Ative o <b>Modo do desenvolvedor</b> (canto superior direito).
              </li>
              <li>
                Clique em <b>Carregar sem compactação</b> e selecione a pasta descompactada.
              </li>
              <li>
                Abra <b>web.whatsapp.com</b> e clique no ícone da extensão para ativar.
              </li>
            </ol>
            {extKey?.extensionApiKey && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Ver chave de API (uso avançado)</summary>
                <code className="block mt-2 rounded bg-muted p-2 break-all">
                  {extKey.extensionApiKey}
                </code>
              </details>
            )}
          </CardContent>
        </Card>

        {showAi && <AiSection />}
      </main>
    </div>
  );
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}

function PlanCard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const optsFn = useServerFn(getPlanChangeOptions);
  const downgradeFn = useServerFn(scheduleDowngrade);
  const cancelFn = useServerFn(cancelScheduledDowngrade);

  const { data } = useQuery({ queryKey: ["plan-options"], queryFn: () => optsFn() });
  const [open, setOpen] = useState(false);

  const downgrade = useMutation({
    mutationFn: (planId: string) => downgradeFn({ data: { planId } }),
    onSuccess: (r) => {
      const quando = r.renewsAt
        ? new Date(r.renewsAt).toLocaleDateString("pt-BR")
        : "a próxima renovação";
      toast.success(`Mudança para o plano ${r.planName} agendada para ${quando}.`);
      qc.invalidateQueries({ queryKey: ["plan-options"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelDowngrade = useMutation({
    mutationFn: () => cancelFn(),
    onSuccess: () => {
      toast.success("Mudança agendada cancelada.");
      qc.invalidateQueries({ queryKey: ["plan-options"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options = data?.options ?? [];
  const current = options.find((p) => p.kind === "current");
  const pending = data?.pendingPlanId ? options.find((p) => p.id === data.pendingPlanId) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meu plano</CardTitle>
        <CardDescription>
          {current ? (
            <>
              Você está no plano <b>{current.name}</b> ({formatBRL(current.priceForCycle)}/
              {data?.billingCycle === "annual" ? "ano" : "mês"}).
            </>
          ) : (
            "Gerencie seu plano."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
            <span>
              Mudança agendada para <b>{pending.name}</b>
              {data?.renewsAt ? ` em ${new Date(data.renewsAt).toLocaleDateString("pt-BR")}` : " na próxima renovação"}.
            </span>
            <Button variant="ghost" size="sm" onClick={() => cancelDowngrade.mutate()} disabled={cancelDowngrade.isPending}>
              Cancelar
            </Button>
          </div>
        )}

        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Trocar de plano
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {options.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 ${p.kind === "current" ? "border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.name}</span>
                    {p.kind === "current" && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <CheckCircle2 className="h-3 w-3" />
                        Atual
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {formatBRL(p.priceForCycle)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{data?.billingCycle === "annual" ? "ano" : "mês"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.monthly_credits.toLocaleString("pt-BR")} créditos/mês
                  </p>
                  {p.kind === "upgrade" && (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() =>
                        navigate({ to: "/checkout", search: { plan: p.id, change: true } })
                      }
                    >
                      <ArrowUpCircle className="h-4 w-4 mr-1" />
                      Fazer upgrade
                    </Button>
                  )}
                  {p.kind === "downgrade" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => downgrade.mutate(p.id)}
                      disabled={downgrade.isPending || data?.pendingPlanId === p.id}
                    >
                      <ArrowDownCircle className="h-4 w-4 mr-1" />
                      {data?.pendingPlanId === p.id ? "Agendado" : "Mudar para este"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <b>Upgrade</b> é cobrado na hora e a nova cota entra ao confirmar o pagamento.{" "}
              <b>Downgrade</b> passa a valer na próxima renovação, sem cobrança agora.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RefundCard() {
  const qc = useQueryClient();
  const eligFn = useServerFn(getMyRefundEligibility);
  const refundFn = useServerFn(requestRefund);
  const { data: elig } = useQuery({
    queryKey: ["refund-eligibility"],
    queryFn: () => eligFn(),
  });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const request = useMutation({
    mutationFn: () => refundFn({ data: { reason: reason.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Solicitação de reembolso enviada. Nossa equipe vai entrar em contato.");
      setOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["refund-eligibility"] });
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Só aparece dentro da janela de garantia. Se já houver pedido em aberto,
  // mostramos um aviso em vez do botão.
  if (!elig) return null;
  if (elig.reason === "expired" || elig.reason === "no-tenant") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Garantia de {elig.windowDays} dias
        </CardTitle>
        <CardDescription>
          {elig.reason === "pending"
            ? "Você já tem uma solicitação de reembolso em andamento. Acompanhe em Suporte."
            : `Não era para você? Dentro de ${elig.windowDays} dias do início da assinatura você pode pedir o reembolso. Restam ${elig.daysLeft} dia${elig.daysLeft === 1 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>
      {elig.reason !== "pending" && (
        <CardContent>
          {!open ? (
            <Button variant="outline" onClick={() => setOpen(true)}>
              Solicitar reembolso
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="refund-reason">Conta pra gente o motivo (opcional)</Label>
                <Textarea
                  id="refund-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="O que não funcionou pra você? Seu feedback nos ajuda a melhorar."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => request.mutate()} disabled={request.isPending}>
                  {request.isPending ? "Enviando…" : "Confirmar solicitação"}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={request.isPending}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function WhatsappNumbersCard({
  numbers,
  maxNumbers,
  onSaved,
}: {
  numbers: string[];
  maxNumbers: number | null;
  onSaved: () => void;
}) {
  const addNumber = useServerFn(addMyWhatsappNumber);
  const removeNumber = useServerFn(removeMyWhatsappNumber);
  const [value, setValue] = useState("");

  const add = useMutation({
    mutationFn: () => addNumber({ data: { number: value } }),
    onSuccess: () => {
      toast.success("Número adicionado.");
      setValue("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (n: string) => removeNumber({ data: { number: n } }),
    onSuccess: () => {
      toast.success("Número removido.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const missing = numbers.length === 0;
  const atLimit = maxNumbers !== null && numbers.length >= maxNumbers;
  return (
    <Card className={missing ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {missing ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <Smartphone className="h-5 w-5 text-primary" />
          )}
          Números de WhatsApp da IA
        </CardTitle>
        <CardDescription>
          {missing
            ? "Obrigatório: cadastre o número do WhatsApp que a IA vai atender. Sem ele, a IA não responde."
            : "A IA só responde nos números desta lista. Cada número usa o próprio WhatsApp Web com a extensão instalada."}
          {maxNumbers !== null && (
            <>
              {" "}
              Seu plano permite {maxNumbers} número{maxNumbers > 1 ? "s" : ""} ({numbers.length}/
              {maxNumbers} em uso).
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {numbers.length > 0 && (
          <ul className="space-y-2">
            {numbers.map((n) => (
              <li
                key={n}
                className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
              >
                <span className="font-mono text-sm">{n}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(n)}
                  disabled={remove.isPending}
                  title="Remover número"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {atLimit ? (
          <p className="text-xs text-muted-foreground">
            Limite do plano atingido. Para adicionar outro número, remova um ou faça upgrade de
            plano.
          </p>
        ) : (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="whatsapp-number">Número com DDI e DDD (só dígitos)</Label>
              <Input
                id="whatsapp-number"
                type="tel"
                placeholder="5511999999999"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={add.isPending || !value.trim()}>
              {add.isPending ? "Adicionando..." : "Adicionar número"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
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
    media_reply_image: "",
    media_reply_document: "",
    media_reply_video: "",
  });
  useEffect(() => {
    if (cfg?.config) {
      const c: any = cfg.config;
      setForm((f) => ({
        ...f,
        temperature: Number(c.temperature ?? 0.7),
        max_tokens: c.max_tokens ?? 500,
        prompt_content: cfg.prompt?.content ?? "",
        media_reply_image: c.media_reply_image ?? "",
        media_reply_document: c.media_reply_document ?? "",
        media_reply_video: c.media_reply_video ?? "",
      }));
    }
  }, [cfg]);

  const save = useMutation({
    mutationFn: () =>
      updCfg({
        data: {
          temperature: form.temperature,
          prompt_content: form.prompt_content || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["my-ai-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMedia = useMutation({
    mutationFn: () =>
      updCfg({
        data: {
          media_reply_image: form.media_reply_image,
          media_reply_document: form.media_reply_document,
          media_reply_video: form.media_reply_video,
        },
      }),
    onSuccess: () => {
      toast.success("Respostas de mídia salvas");
      qc.invalidateQueries({ queryKey: ["my-ai-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const saveKB = useMutation({
    mutationFn: () =>
      upsertKB({
        data: {
          id: editing.id || undefined,
          question: editing.question,
          answer: editing.answer,
          tags: editing.tags ?? [],
          is_active: editing.is_active ?? true,
        },
      }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["my-kb"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeKB = useMutation({
    mutationFn: (id: string) => delKB({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["my-kb"] });
    },
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
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 4MB).");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = () => rej(new Error("Falha ao ler o arquivo"));
        r.readAsDataURL(file);
      });
      const out = await uploadFile({ data: { filename: file.name, base64 } });
      toast.success(
        `Arquivo adicionado (${out.chars.toLocaleString("pt-BR")} caracteres extraídos)`,
      );
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
    onSuccess: () => {
      toast.success("Arquivo removido");
      qc.invalidateQueries({ queryKey: ["my-kb-files"] });
    },
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
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Controla a liberdade da IA. O ideal para atendimento é{" "}
              <strong>0.7 = equilibrado</strong>.{" "}
              <strong>1.0+ = mais criativo, mas pode inventar</strong>.
            </p>
          </div>

          <div>
            <Label>Prompt da minha empresa</Label>
            <Textarea
              rows={6}
              value={form.prompt_content}
              onChange={(e) => setForm({ ...form, prompt_content: e.target.value })}
              placeholder="Ex.: Você é o atendente virtual da Padaria do João. Seja sempre cordial, ofereça opções de delivery e horário de funcionamento (8h-20h). Não invente preços que não estejam na base de conhecimento."
            />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Respostas para mídia (imagem, documento e vídeo)</CardTitle>
          <CardDescription>
            A IA não interpreta imagens, documentos ou vídeos. Quando o cliente enviar um desses, ela
            responde automaticamente com o texto que você definir aqui e <b>deixa a conversa marcada
            como não lida no WhatsApp</b>, para você ver e responder. (Áudios são transcritos e
            respondidos normalmente.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Quando receber uma imagem</Label>
            <Textarea
              rows={2}
              value={form.media_reply_image}
              onChange={(e) => setForm({ ...form, media_reply_image: e.target.value })}
              placeholder="Ex.: Recebi sua imagem! 👀 Já vou verificar e te respondo em instantes."
            />
          </div>
          <div>
            <Label>Quando receber um documento</Label>
            <Textarea
              rows={2}
              value={form.media_reply_document}
              onChange={(e) => setForm({ ...form, media_reply_document: e.target.value })}
              placeholder="Ex.: Recebi seu documento! 📄 Vou analisar e já te retorno."
            />
          </div>
          <div>
            <Label>Quando receber um vídeo</Label>
            <Textarea
              rows={2}
              value={form.media_reply_video}
              onChange={(e) => setForm({ ...form, media_reply_video: e.target.value })}
              placeholder="Ex.: Recebi seu vídeo! 🎥 Já vou assistir e te respondo em seguida."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe um campo em branco para a IA não responder nada àquele tipo de mídia — ela ainda
            marca a conversa como não lida.
          </p>
          <Button onClick={() => saveMedia.mutate()} disabled={saveMedia.isPending}>
            {saveMedia.isPending ? "Salvando…" : "Salvar respostas de mídia"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Base de conhecimento</CardTitle>
              <CardDescription>
                Perguntas e respostas que a IA consulta antes de responder.
              </CardDescription>
            </div>
            <Button
              onClick={() => setEditing({ question: "", answer: "", tags: [], is_active: true })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova entrada
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(kb ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhuma entrada cadastrada.</p>
          )}
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
                <Button size="icon" variant="ghost" onClick={() => setEditing(k)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover?")) removeKB.mutate(k.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
              <CardDescription>
                Envie documentos (PDF, TXT, MD, CSV) — a IA usa o conteúdo deles para responder.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Enviando…" : "Enviar arquivo"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.csv"
              className="hidden"
              onChange={onPickFile}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              Arquivos aumentam o consumo de créditos
            </p>
            <p className="text-muted-foreground mt-1">
              O conteúdo dos arquivos <strong>ativos</strong> é enviado junto com{" "}
              <strong>cada resposta</strong> da IA, o que aumenta o custo em créditos por mensagem —
              quanto mais texto ativo, maior o consumo. Mantenha ativos apenas os arquivos realmente
              necessários e prefira documentos enxutos. Você pode desativar um arquivo a qualquer
              momento sem excluí-lo.
            </p>
          </div>
          {(files ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nenhum arquivo enviado. Até 10 arquivos de no máximo 4MB cada.
            </p>
          )}
          {(files ?? []).map((f: any) => (
            <div key={f.id} className="border rounded p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{f.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(f.char_count).toLocaleString("pt-BR")} caracteres extraídos
                  </p>
                </div>
                {!f.is_active && <Badge variant="secondary">inativo</Badge>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={f.is_active}
                  onCheckedChange={(c) => togFile.mutate({ id: f.id, is_active: c })}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover arquivo?")) remFile.mutate(f.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar entrada" : "Nova entrada"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Pergunta / gatilho</Label>
                <Input
                  value={editing.question}
                  onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                />
              </div>
              <div>
                <Label>Resposta</Label>
                <Textarea
                  rows={6}
                  value={editing.answer}
                  onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(c) => setEditing({ ...editing, is_active: c })}
                />
                <Label>Ativo</Label>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveKB.mutate()}
                  disabled={saveKB.isPending || !editing.question || !editing.answer}
                >
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
