import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { getPublicPlans } from "@/lib/plans.functions";
import { publicSignup } from "@/lib/signup.functions";

export const Route = createFileRoute("/assinar")({
  validateSearch: (s: Record<string, unknown>): { plan?: string } => ({
    plan: typeof s.plan === "string" ? s.plan : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criar conta — Argos" },
      {
        name: "description",
        content:
          "Crie sua conta na Argos, escolha o plano e ative a IA no seu WhatsApp em minutos.",
      },
    ],
  }),
  component: SignupPage,
});

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}

function SignupPage() {
  const navigate = useNavigate();
  const { plan: planParam } = Route.useSearch();
  const fetchPlans = useServerFn(getPublicPlans);
  const signupFn = useServerFn(publicSignup);

  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    phone: "",
    email: "",
    password: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  // Quem já está logado segue direto para o painel (o gate manda para o
  // checkout se a conta ainda estiver pendente de pagamento).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const { data: plansData } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => fetchPlans(),
    staleTime: 5 * 60 * 1000,
  });
  const plans = plansData?.plans ?? [];
  const selectedPlan = planParam ? plans.find((p) => p.id === planParam) : undefined;

  const signup = useMutation({
    mutationFn: () =>
      signupFn({
        data: {
          fullName: form.fullName,
          companyName: form.companyName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          planId: selectedPlan?.id,
        },
      }),
    onSuccess: async () => {
      window.fbq?.("track", "Lead");
      const r = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (r.error) {
        toast.success("Conta criada! Faça login para continuar.");
        navigate({ to: "/login" });
        return;
      }
      const { invalidateAuthGate } = await import("./_authenticated/route");
      invalidateAuthGate();
      toast.success("Conta criada! Agora é só ativar o plano.");
      navigate({ to: "/checkout", search: { plan: selectedPlan?.id }, replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center">
            <Logo size={32} />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Crie sua conta</h1>
          <p className="mt-2 text-muted-foreground">
            Preencha seus dados, ative o plano e em minutos a IA está respondendo no seu WhatsApp.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-5">
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Seus dados</CardTitle>
              <CardDescription>
                Usamos essas informações para criar sua conta e emitir as cobranças.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  signup.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="fullName">Seu nome</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={set("fullName")}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da empresa</Label>
                  <Input
                    id="companyName"
                    value={form.companyName}
                    onChange={set("companyName")}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp (com DDD)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="11 99999-9999"
                    value={form.phone}
                    onChange={set("phone")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha (mínimo 8 caracteres)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={set("password")}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={signup.isPending}>
                  {signup.isPending ? (
                    "Criando conta..."
                  ) : (
                    <>
                      Continuar para o pagamento <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Ao criar a conta você concorda com os{" "}
                  <Link to="/termos" className="underline hover:text-foreground">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" className="underline hover:text-foreground">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-4">
            <Card className={selectedPlan ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedPlan ? `Plano ${selectedPlan.name}` : "Plano"}
                </CardTitle>
                {selectedPlan ? (
                  <>
                    {selectedPlan.description && (
                      <CardDescription>{selectedPlan.description}</CardDescription>
                    )}
                    <div className="mt-1 text-2xl font-bold">
                      {formatBRL(selectedPlan.priceCents)}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedPlan.monthlyCredits.toLocaleString("pt-BR")} créditos de IA por mês
                    </p>
                  </>
                ) : (
                  <CardDescription>
                    Você escolhe o plano na próxima etapa, junto com a forma de pagamento.
                  </CardDescription>
                )}
              </CardHeader>
              {selectedPlan && selectedPlan.features.length > 0 && (
                <CardContent>
                  <ul className="space-y-1.5">
                    {selectedPlan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Quer outro plano?{" "}
                    <Link to="/" hash="pricing" className="underline hover:text-foreground">
                      Ver todos os planos
                    </Link>
                  </p>
                </CardContent>
              )}
            </Card>

            <div className="rounded-lg border bg-background p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" /> Como funciona a ativação
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Você cria a conta agora (seus dados ficam salvos).</li>
                <li>Na próxima tela, paga via Pix ou cartão.</li>
                <li>Confirmou o pagamento, o acesso libera na hora.</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Sem fidelidade. Cancele quando quiser.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
