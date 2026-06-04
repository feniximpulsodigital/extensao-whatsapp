import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Bot, LogOut, Settings, AlertTriangle, Zap, Brain } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyCreditsSummary } from "@/lib/ai-credits.functions";
import { getMyExtensionApiKey } from "@/lib/billing.functions";

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

  const handleLogout = async () => {
    const { invalidateAuthGate } = await import("./route");
    invalidateAuthGate();
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

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
            <Button asChild variant="outline" size="sm">
              <Link to="/ai"><Brain className="h-4 w-4 mr-2" />Minha IA</Link>
            </Button>
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
            <CardTitle>Chave da extensão</CardTitle>
            <CardDescription>Use esta chave na extensão Chrome</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-3 text-sm break-all">
              {extKey?.extensionApiKey ?? "—"}
            </code>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
