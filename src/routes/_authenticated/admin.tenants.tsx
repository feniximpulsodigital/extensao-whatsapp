import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, KeyRound, Coins } from "lucide-react";
import { toast } from "sonner";
import { adminListTenants, adminListPlans } from "@/lib/billing.functions";
import { adminUpdateTenant, adminAddCredits, adminGeneratePasswordLink, adminCreateInvite } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/tenants")({
  component: TenantsPage,
});

function TenantsPage() {
  const list = useServerFn(adminListTenants);
  const listPlans = useServerFn(adminListPlans);
  const updateTenant = useServerFn(adminUpdateTenant);
  const addCredits = useServerFn(adminAddCredits);
  const resetPwd = useServerFn(adminGeneratePasswordLink);
  const createInvite = useServerFn(adminCreateInvite);
  const qc = useQueryClient();

  const { data: tenants, isLoading } = useQuery({ queryKey: ["admin-tenants"], queryFn: () => list() });
  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => listPlans() });

  const [editing, setEditing] = useState<any | null>(null);
  const [creditModal, setCreditModal] = useState<{ id: string; name: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditNote, setCreditNote] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({
    email: "", fullName: "", companyName: "", phone: "",
    planId: "", billingCycle: "monthly" as "monthly"|"annual"|"free",
    customAllowance: 0, amountCents: 0, expiresInDays: 7,
  });
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const upd = useMutation({
    mutationFn: (v: any) => updateTenant({ data: v }),
    onSuccess: () => { toast.success("Cliente atualizado"); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cred = useMutation({
    mutationFn: () => addCredits({ data: { tenantId: creditModal!.id, amount: creditAmount, description: creditNote || undefined } }),
    onSuccess: () => { toast.success("Créditos ajustados"); qc.invalidateQueries({ queryKey: ["admin-tenants"] }); setCreditModal(null); setCreditAmount(0); setCreditNote(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const inv = useMutation({
    mutationFn: () => createInvite({ data: {
      email: invite.email, fullName: invite.fullName, companyName: invite.companyName,
      phone: invite.phone || undefined,
      planId: invite.planId || null,
      billingCycle: invite.billingCycle,
      customAllowance: invite.customAllowance || undefined,
      amountCents: invite.amountCents,
      expiresInDays: invite.expiresInDays,
    }}),
    onSuccess: (r) => {
      const url = `${window.location.origin}/invite/${r.token}`;
      setCreatedLink(url);
      qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      qc.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("Convite criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <Button onClick={() => { setInviteOpen(true); setCreatedLink(null); }}>
          <Plus className="h-4 w-4 mr-2" />Criar convite
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de clientes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Carregando…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>E-mail de acesso</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tenants ?? []).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.company_name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.owner_email ?? "—"}</TableCell>
                    <TableCell>{t.plans?.name ?? "—"}</TableCell>
                    <TableCell>{t.billing_cycle ?? "—"}</TableCell>
                    <TableCell>{t.credits_balance}</TableCell>
                    <TableCell><Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Ajustar créditos" onClick={() => setCreditModal({ id: t.id, name: t.company_name })}><Coins className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Reset senha" onClick={async () => {
                        try {
                          const r = await resetPwd({ data: { tenantId: t.id } });
                          if (r.actionLink) {
                            await navigator.clipboard.writeText(r.actionLink);
                            toast.success("Link de reset copiado!");
                          }
                        } catch (e) { toast.error((e as Error).message); }
                      }}><KeyRound className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit tenant */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Empresa</Label><Input value={editing.company_name} disabled /></div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["trial","pending_payment","active","suspended","cancelled"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={editing.plan_id ?? ""} onValueChange={(v) => setEditing({ ...editing, plan_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Sem plano" /></SelectTrigger>
                  <SelectContent>
                    {(plans ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.is_custom ? " (custom)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Trocar o plano não altera os créditos nem gera cobrança. Use "Ajustar créditos" se quiser creditar a nova cota.
                </p>
              </div>
              <div>
                <Label>Cota mensal de créditos (sobrescreve o plano)</Label>
                <Input type="number" value={editing.credits_monthly_allowance ?? 0} onChange={(e) => setEditing({ ...editing, credits_monthly_allowance: parseInt(e.target.value || "0") })} />
              </div>
              <div><Label>Notas internas</Label><Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              <DialogFooter>
                <Button onClick={() => upd.mutate({
                  tenantId: editing.id, status: editing.status, plan_id: editing.plan_id,
                  credits_monthly_allowance: editing.credits_monthly_allowance, notes: editing.notes,
                })} disabled={upd.isPending}>{upd.isPending ? "Salvando…" : "Salvar"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add credits */}
      <Dialog open={!!creditModal} onOpenChange={(o) => !o && setCreditModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar créditos — {creditModal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quantidade (use negativo para descontar)</Label><Input type="number" value={creditAmount} onChange={(e) => setCreditAmount(parseInt(e.target.value || "0"))} /></div>
            <div><Label>Descrição</Label><Input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} placeholder="Ex: bônus boas-vindas" /></div>
            <DialogFooter><Button onClick={() => cred.mutate()} disabled={cred.isPending || creditAmount === 0}>{cred.isPending ? "Aplicando…" : "Aplicar"}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create invite */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setCreatedLink(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Criar convite para cliente</DialogTitle></DialogHeader>
          {createdLink ? (
            <div className="space-y-3">
              <p className="text-sm">Envie este link para o cliente:</p>
              <div className="flex gap-2">
                <Input readOnly value={createdLink} />
                <Button onClick={() => { navigator.clipboard.writeText(createdLink); toast.success("Copiado!"); }}>Copiar</Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setCreatedLink(null); setInviteOpen(false); }}>Fechar</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>E-mail</Label><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
                <div><Label>Nome</Label><Input value={invite.fullName} onChange={(e) => setInvite({ ...invite, fullName: e.target.value })} /></div>
                <div><Label>Empresa</Label><Input value={invite.companyName} onChange={(e) => setInvite({ ...invite, companyName: e.target.value })} /></div>
                <div className="col-span-2"><Label>Telefone (opcional)</Label><Input value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>Plano</Label>
                  <Select value={invite.planId} onValueChange={(v) => setInvite({ ...invite, planId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(plans ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.is_custom ? " (custom)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ciclo</Label>
                  <Select value={invite.billingCycle} onValueChange={(v: any) => setInvite({ ...invite, billingCycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                      <SelectItem value="free">Cortesia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor a cobrar (R$)</Label><Input type="number" step="0.01" value={(invite.amountCents/100).toFixed(2)} onChange={(e) => setInvite({ ...invite, amountCents: Math.round(parseFloat(e.target.value || "0") * 100) })} /></div>
                <div><Label>Cota de créditos/mês</Label><Input type="number" value={invite.customAllowance} onChange={(e) => setInvite({ ...invite, customAllowance: parseInt(e.target.value || "0") })} /></div>
                <div><Label>Validade do link (dias)</Label><Input type="number" value={invite.expiresInDays} onChange={(e) => setInvite({ ...invite, expiresInDays: parseInt(e.target.value || "7") })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => inv.mutate()} disabled={inv.isPending}>{inv.isPending ? "Criando…" : "Criar convite"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
