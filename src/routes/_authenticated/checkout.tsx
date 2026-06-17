import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bot, Check, LogOut, CreditCard, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listActivePlans, createCheckout, getMyTenant } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (s: Record<string, unknown>): { plan?: string; change?: boolean } => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
    change: s.change === "1" || s.change === true,
  }),
  head: () => ({ meta: [{ title: "Pagamento — Argos" }] }),
  component: CheckoutPage,
  errorComponent: ({ error }) => <div className="p-6">Erro: {error.message}</div>,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const fetchPlans = useServerFn(listActivePlans);
  const fetchTenant = useServerFn(getMyTenant);
  const checkout = useServerFn(createCheckout);

  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  // Cartão é o método preferencial (pré-selecionado).
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [cpfCnpj, setCpfCnpj] = useState("");

  const { plan: planParam, change: changeMode } = Route.useSearch();
  const { data: tenant } = useQuery({ queryKey: ["tenant"], queryFn: () => fetchTenant() });
  const { data: plans, isLoading } = useQuery({ queryKey: ["plans"], queryFn: () => fetchPlans() });

  useEffect(() => {
    // Cliente ativo só é redirecionado quando NÃO está trocando de plano.
    // Em modo troca (?change=1) ele permanece para pagar o upgrade.
    if (tenant?.status === "active" && !changeMode) navigate({ to: "/dashboard", replace: true });
  }, [tenant, navigate, changeMode]);

  // Pré-seleciona o plano vindo do cadastro (?plan=) ou já gravado no tenant.
  useEffect(() => {
    if (selectedPlan || !plans?.length) return;
    const candidate = [planParam, tenant?.plan_id].find(
      (id) => id && plans.some((p) => p.id === id),
    );
    if (candidate) setSelectedPlan(candidate);
  }, [planParam, plans, tenant, selectedPlan]);

  const docOk = [11, 14].includes(cpfCnpj.replace(/\D/g, "").length);

  const pay = useMutation({
    mutationFn: (planId: string) =>
      checkout({ data: { planId, billingCycle: cycle, method, cpfCnpj } }),
    onSuccess: (r) => {
      // Redireciona para a página de pagamento segura e hospedada do Asaas,
      // onde o cliente escolhe cartão ou PIX. Nenhum dado de cartão passa por
      // aqui. A confirmação/ativação acontece pelo webhook do Asaas.
      window.location.href = r.invoiceUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logout = async () => {
    const { invalidateAuthGate } = await import("./route");
    invalidateAuthGate();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-bold">Argos</span>
          </div>
          <Button onClick={logout} variant="ghost" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{changeMode ? "Trocar de plano" : "Escolha seu plano"}</h1>
          <p className="text-muted-foreground">
            {changeMode
              ? "Escolha o novo plano. O upgrade é cobrado agora e a nova cota entra ao confirmar o pagamento."
              : "Ative sua conta para começar a usar o Argos"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className={cycle === "monthly" ? "font-semibold" : "text-muted-foreground"}>
            Mensal
          </span>
          <Switch
            checked={cycle === "annual"}
            onCheckedChange={(c) => setCycle(c ? "annual" : "monthly")}
          />
          <span className={cycle === "annual" ? "font-semibold" : "text-muted-foreground"}>
            Anual <span className="text-xs text-primary">(economize)</span>
          </span>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground">Carregando planos...</p>
        ) : !plans || plans.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Nenhum plano configurado. O administrador precisa cadastrar planos.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => {
              const cents = cycle === "annual" ? p.price_cents_annual : p.price_cents;
              const selected = selectedPlan === p.id;
              return (
                <Card
                  key={p.id}
                  className={`cursor-pointer transition ${selected ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedPlan(p.id)}
                >
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-3xl font-bold">
                      R$ {(cents / 100).toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{cycle === "annual" ? "ano" : "mês"}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {p.monthly_credits} créditos/mês
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {p.max_knowledge_entries} entradas na base
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selectedPlan && (
          <Card>
            <CardHeader>
              <CardTitle>Pagamento</CardTitle>
              <CardDescription>
                Você será levado à página de pagamento segura para concluir a assinatura.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="max-w-sm space-y-2">
                <Label htmlFor="cpf">CPF ou CNPJ do pagador</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  placeholder="Somente números"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Necessário para emitir a cobrança.</p>
              </div>

              {/* Escolha do método — cartão é o preferencial */}
              <div>
                <Label className="mb-2 block">Como você quer pagar?</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMethod("card")}
                    className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
                      method === "card"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      RECOMENDADO
                    </span>
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        method === "card" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">Cartão de crédito</p>
                      <p className="text-xs text-muted-foreground">
                        Renova sozinho todo {cycle === "annual" ? "ano" : "mês"}.
                      </p>
                    </div>
                    {method === "card" && <Check className="absolute bottom-3 right-3 h-4 w-4 text-primary" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("pix")}
                    className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
                      method === "pix"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        method === "pix" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">PIX</p>
                      <p className="text-xs text-muted-foreground">
                        Nova cobrança PIX a cada {cycle === "annual" ? "ano" : "mês"}.
                      </p>
                    </div>
                    {method === "pix" && <Check className="absolute bottom-3 right-3 h-4 w-4 text-primary" />}
                  </button>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={pay.isPending || !docOk}
                onClick={() => pay.mutate(selectedPlan)}
              >
                {pay.isPending
                  ? "Abrindo pagamento…"
                  : method === "card"
                    ? "Pagar com cartão"
                    : "Pagar com PIX"}
              </Button>

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Pagamento processado com segurança pelo Asaas. Seus dados de cartão não passam pela
                Argos. Sem fidelidade, cancele quando quiser.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
