import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { adminListTenants } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/admin/tenants")({
  component: TenantsPage,
});

function TenantsPage() {
  const list = useServerFn(adminListTenants);
  const { data, isLoading } = useQuery({ queryKey: ["admin-tenants"], queryFn: () => list() });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.company_name}</TableCell>
                  <TableCell>{t.plans?.name ?? "—"}</TableCell>
                  <TableCell>{t.billing_cycle ?? "—"}</TableCell>
                  <TableCell>{t.credits_balance}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
