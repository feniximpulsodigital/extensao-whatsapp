import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getAppSettings, updateAppSettings } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const fetchSettings = useServerFn(getAppSettings);
  const save = useServerFn(updateAppSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchSettings() });

  const [form, setForm] = useState({
    asaas_env: "sandbox" as "sandbox" | "production",
    asaas_api_key_sandbox: "",
    asaas_api_key_production: "",
    asaas_webhook_token: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        asaas_env: (data.asaas_env as "sandbox" | "production") ?? "sandbox",
        asaas_api_key_sandbox: data.asaas_api_key_sandbox ?? "",
        asaas_api_key_production: data.asaas_api_key_production ?? "",
        asaas_webhook_token: data.asaas_webhook_token ?? "",
      });
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          asaas_env: form.asaas_env,
          asaas_api_key_sandbox: form.asaas_api_key_sandbox || null,
          asaas_api_key_production: form.asaas_api_key_production || null,
          asaas_webhook_token: form.asaas_webhook_token || null,
        },
      }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p>Carregando...</p>;

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/asaas-webhook` : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ambiente Asaas</CardTitle>
          <CardDescription>Alterne entre sandbox (testes) e produção (cobranças reais)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded border p-4">
            <div>
              <p className="font-medium">
                Modo atual: <Badge variant={form.asaas_env === "production" ? "destructive" : "secondary"}>
                  {form.asaas_env === "production" ? "PRODUÇÃO" : "SANDBOX"}
                </Badge>
              </p>
              <p className="text-sm text-muted-foreground">
                {form.asaas_env === "production"
                  ? "Cobranças reais serão feitas no cartão do cliente."
                  : "Modo de testes — nenhum valor é cobrado de verdade."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Sandbox</span>
              <Switch
                checked={form.asaas_env === "production"}
                onCheckedChange={(c) => setForm({ ...form, asaas_env: c ? "production" : "sandbox" })}
              />
              <span className="text-sm">Produção</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chaves de API</CardTitle>
          <CardDescription>
            Obtenha em: Asaas → Integrações → Chave API (uma para cada ambiente)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Chave Sandbox</Label>
            <Input
              type="password"
              placeholder="$aact_..."
              value={form.asaas_api_key_sandbox}
              onChange={(e) => setForm({ ...form, asaas_api_key_sandbox: e.target.value })}
            />
          </div>
          <div>
            <Label>Chave Produção</Label>
            <Input
              type="password"
              placeholder="$aact_prod_..."
              value={form.asaas_api_key_production}
              onChange={(e) => setForm({ ...form, asaas_api_key_production: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>
            Configure no Asaas → Integrações → Webhooks. Use a URL abaixo e um token que você define.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL do webhook</Label>
            <Input readOnly value={webhookUrl} />
          </div>
          <div>
            <Label>Token de autenticação</Label>
            <Input
              type="password"
              placeholder="defina um token seguro"
              value={form.asaas_webhook_token}
              onChange={(e) => setForm({ ...form, asaas_webhook_token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              No Asaas, em "Token de autenticação" cole o mesmo valor.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="lg">
        {mut.isPending ? "Salvando..." : "Salvar configurações"}
      </Button>
    </div>
  );
}
