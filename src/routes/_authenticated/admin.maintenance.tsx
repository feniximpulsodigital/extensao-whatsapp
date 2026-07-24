import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getMaintenanceHistory, runMaintenanceNow } from "@/lib/maintenance.functions";

export const Route = createFileRoute("/_authenticated/admin/maintenance")({
  head: () => ({ meta: [{ title: "Manutenção — Argos" }] }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const fetchHistory = useServerFn(getMaintenanceHistory);
  const runNow = useServerFn(runMaintenanceNow);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-history"],
    queryFn: () => fetchHistory(),
  });

  const mut = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (r) => {
      if (r.ok) toast.success("Verificação executada com sucesso.");
      else toast.error("Verificação executada, mas com erro. Veja o histórico.");
      qc.invalidateQueries({ queryKey: ["maintenance-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runs = data?.runs ?? [];
  const last = runs[0];
  const nextDue = last ? new Date(new Date(last.ran_at).getTime() + 5 * 24 * 60 * 60 * 1000) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Rotina de manutenção automática</CardTitle>
          </div>
          <CardDescription>
            Mantém o banco de dados ativo executando uma verificação leve a cada 5 dias — evita
            que o Supabase pause o projeto por inatividade. Roda sozinha em segundo plano; esta
            página é só para acompanhar e, se quiser, disparar uma verificação manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm text-muted-foreground">Última execução</p>
              <p className="font-medium">
                {last ? new Date(last.ran_at).toLocaleString("pt-BR") : "Ainda não rodou"}
              </p>
            </div>
            {nextDue && (
              <div>
                <p className="text-sm text-muted-foreground">Próxima prevista</p>
                <p className="font-medium">{nextDue.toLocaleString("pt-BR")}</p>
              </div>
            )}
            {last && (
              <Badge variant={last.status === "ok" ? "secondary" : "destructive"} className="ml-auto">
                {last.status === "ok" ? "OK" : "Erro"}
              </Badge>
            )}
          </div>

          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${mut.isPending ? "animate-spin" : ""}`} />
            {mut.isPending ? "Executando..." : "Executar verificação agora"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Últimas 20 execuções</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  {r.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{new Date(r.ran_at).toLocaleString("pt-BR")}</p>
                    {r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                  </div>
                  {r.tenants_count !== null && (
                    <span className="text-xs text-muted-foreground">
                      {r.tenants_count} clientes
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
