import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { adminListInvites, adminRevokeInvite } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const list = useServerFn(adminListInvites);
  const revoke = useServerFn(adminRevokeInvite);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-invites"], queryFn: () => list() });

  const rev = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Convite revogado"); qc.invalidateQueries({ queryKey: ["admin-invites"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Convites</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p>Carregando…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((i: any) => {
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${i.token}`;
                return (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>{i.company_name}</TableCell>
                    <TableCell>{i.plans?.name ?? "—"}</TableCell>
                    <TableCell>{i.billing_cycle}</TableCell>
                    <TableCell>{i.amount_cents > 0 ? `R$ ${(i.amount_cents/100).toFixed(2)}` : "Cortesia"}</TableCell>
                    <TableCell><Badge variant={i.status === "paid" || i.status === "accepted" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                    <TableCell>{new Date(i.expires_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="icon" variant="ghost" title="Copiar link" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado!"); }}><Copy className="h-4 w-4" /></Button>
                      {i.status === "pending" && (
                        <Button size="icon" variant="ghost" title="Revogar" onClick={() => rev.mutate(i.id)}><X className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
