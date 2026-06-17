import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Bot, Check, Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listActivePlans,
  createPixCharge,
  createCardSubscription,
  checkPaymentStatus,
  getMyTenant,
} from "@/lib/billing.functions";

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
  const qc = useQueryClient();
  const fetchPlans = useServerFn(listActivePlans);
  const fetchTenant = useServerFn(getMyTenant);
  const createPix = useServerFn(createPixCharge);
  const createCard = useServerFn(createCardSubscription);
  const checkStatus = useServerFn(checkPaymentStatus);

  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [pixCpfCnpj, setPixCpfCnpj] = useState("");
  const [pixModal, setPixModal] = useState<{
    paymentId: string;
    qr: string;
    copyPaste: string;
    invoiceUrl: string;
  } | null>(null);

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

  const pixMut = useMutation({
    mutationFn: (planId: string) =>
      createPix({ data: { planId, billingCycle: cycle, cpfCnpj: pixCpfCnpj.replace(/\D/g, "") } }),
    onSuccess: (r) =>
      setPixModal({
        paymentId: r.paymentId,
        qr: r.pixQrCode,
        copyPaste: r.pixCopyPaste,
        invoiceUrl: r.invoiceUrl,
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Poll PIX status
  useEffect(() => {
    if (!pixModal) return;
    const i = setInterval(async () => {
      try {
        const r = await checkStatus({ data: { paymentId: pixModal.paymentId } });
        if (r.status === "confirmed" || r.status === "received") {
          clearInterval(i);
          toast.success("Pagamento confirmado!");
          const { invalidateAuthGate } = await import("./route");
          invalidateAuthGate();
          await qc.invalidateQueries();
          navigate({ to: "/dashboard", replace: true });
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(i);
  }, [pixModal, checkStatus, navigate, qc]);

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
              <CardTitle>Forma de pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pix">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pix">PIX recorrente</TabsTrigger>
                  <TabsTrigger value="card">Cartão recorrente</TabsTrigger>
                </TabsList>
                <TabsContent value="pix" className="pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Assinatura via PIX. Você paga o primeiro PIX agora e, a cada{" "}
                    {cycle === "annual" ? "ano" : "mês"}, o Asaas envia uma nova cobrança PIX para
                    renovar. Após a confirmação, seu acesso é liberado automaticamente.
                  </p>
                  <div className="max-w-xs">
                    <Label htmlFor="pix-cpf">CPF ou CNPJ do pagador</Label>
                    <Input
                      id="pix-cpf"
                      inputMode="numeric"
                      placeholder="Somente números"
                      value={pixCpfCnpj}
                      onChange={(e) => setPixCpfCnpj(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Obrigatório para emitir a cobrança no Asaas.
                    </p>
                  </div>
                  <Button
                    onClick={() => pixMut.mutate(selectedPlan)}
                    disabled={
                      pixMut.isPending ||
                      ![11, 14].includes(pixCpfCnpj.replace(/\D/g, "").length)
                    }
                    size="lg"
                  >
                    {pixMut.isPending ? "Gerando PIX..." : "Gerar PIX"}
                  </Button>
                </TabsContent>
                <TabsContent value="card" className="pt-4">
                  <CardForm
                    planId={selectedPlan}
                    cycle={cycle}
                    onSubmit={async (form) => {
                      try {
                        await createCard({
                          data: { planId: selectedPlan, billingCycle: cycle, ...form },
                        });
                        toast.success("Assinatura criada! Aguarde a confirmação.");
                        await qc.invalidateQueries();
                        setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1500);
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={!!pixModal} onOpenChange={(o) => !o && setPixModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pague com PIX</DialogTitle>
            <DialogDescription>Aguardando confirmação...</DialogDescription>
          </DialogHeader>
          {pixModal && (
            <div className="space-y-4">
              <img
                src={`data:image/png;base64,${pixModal.qr}`}
                alt="QR PIX"
                className="mx-auto w-64 h-64"
              />
              <div>
                <Label>Copia e cola</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={pixModal.copyPaste} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pixModal.copyPaste);
                      toast.success("Copiado!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <a
                href={pixModal.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary underline"
              >
                Ver fatura no Asaas
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardForm({
  onSubmit,
}: {
  planId: string;
  cycle: "monthly" | "annual";
  onSubmit: (data: {
    holderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
    holderEmail: string;
    holderCpfCnpj: string;
    holderPostalCode: string;
    holderAddressNumber: string;
    holderPhone: string;
  }) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    holderName: "",
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
    holderEmail: "",
    holderCpfCnpj: "",
    holderPostalCode: "",
    holderAddressNumber: "",
    holderPhone: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        await onSubmit(form);
        setLoading(false);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nome no cartão</Label>
          <Input value={form.holderName} onChange={set("holderName")} required />
        </div>
        <div className="col-span-2">
          <Label>Número do cartão</Label>
          <Input value={form.cardNumber} onChange={set("cardNumber")} required />
        </div>
        <div>
          <Label>Mês (MM)</Label>
          <Input maxLength={2} value={form.expiryMonth} onChange={set("expiryMonth")} required />
        </div>
        <div>
          <Label>Ano (AAAA)</Label>
          <Input maxLength={4} value={form.expiryYear} onChange={set("expiryYear")} required />
        </div>
        <div>
          <Label>CVV</Label>
          <Input maxLength={4} value={form.ccv} onChange={set("ccv")} required />
        </div>
        <div>
          <Label>CPF/CNPJ</Label>
          <Input value={form.holderCpfCnpj} onChange={set("holderCpfCnpj")} required />
        </div>
        <div className="col-span-2">
          <Label>E-mail</Label>
          <Input type="email" value={form.holderEmail} onChange={set("holderEmail")} required />
        </div>
        <div>
          <Label>CEP</Label>
          <Input value={form.holderPostalCode} onChange={set("holderPostalCode")} required />
        </div>
        <div>
          <Label>Número do endereço</Label>
          <Input value={form.holderAddressNumber} onChange={set("holderAddressNumber")} required />
        </div>
        <div className="col-span-2">
          <Label>Telefone</Label>
          <Input value={form.holderPhone} onChange={set("holderPhone")} required />
        </div>
      </div>
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? "Processando..." : "Assinar"}
      </Button>
    </form>
  );
}
