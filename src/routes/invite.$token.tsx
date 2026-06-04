import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bot, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getInviteByToken,
  acceptInviteSetPassword,
  createInvitePixPayment,
  checkInvitePayment,
} from "@/lib/invites.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Convite — Argos" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchInvite = useServerFn(getInviteByToken);
  const acceptFn = useServerFn(acceptInviteSetPassword);
  const pixFn = useServerFn(createInvitePixPayment);
  const checkFn = useServerFn(checkInvitePayment);

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvite({ data: { token } }),
  });

  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"form" | "pay">("form");
  const [pix, setPix] = useState<{ paymentId: string; qr: string; copy: string; invoiceUrl: string } | null>(null);

  const accept = useMutation({
    mutationFn: () => acceptFn({ data: { token, password } }),
    onSuccess: async (res) => {
      // Auto-login
      const r = await supabase.auth.signInWithPassword({ email: res.email, password });
      if (r.error) {
        toast.error("Conta criada. Faça login manualmente.");
        navigate({ to: "/login" });
        return;
      }
      if (res.requiresPayment) {
        setStage("pay");
      } else {
        toast.success("Conta ativada!");
        navigate({ to: "/dashboard", replace: true });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: () => pixFn({ data: { token } }),
    onSuccess: (r) => setPix({ paymentId: r.paymentId, qr: r.pixQrCode, copy: r.pixCopyPaste, invoiceUrl: r.invoiceUrl }),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!pix) return;
    const i = setInterval(async () => {
      const r = await checkFn({ data: { paymentId: pix.paymentId } });
      if (r.status === "confirmed" || r.status === "received") {
        clearInterval(i);
        toast.success("Pagamento confirmado!");
        navigate({ to: "/dashboard", replace: true });
      }
    }, 4000);
    return () => clearInterval(i);
  }, [pix, checkFn, navigate]);

  if (isLoading) return <div className="p-10 text-center">Carregando convite…</div>;
  if (error || !invite) return <div className="p-10 text-center text-destructive">Convite inválido.</div>;
  if (invite.expired) return <div className="p-10 text-center text-destructive">Este convite expirou.</div>;
  if (invite.status === "revoked") return <div className="p-10 text-center text-destructive">Convite revogado.</div>;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold">Argos</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo, {invite.fullName}</CardTitle>
            <CardDescription>
              Você foi convidado para a Argos pela empresa <strong>{invite.companyName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invite.plan && (
              <div className="rounded-lg border bg-card p-4 space-y-1">
                <p className="font-semibold">{invite.plan.name}</p>
                {invite.plan.description && <p className="text-sm text-muted-foreground">{invite.plan.description}</p>}
                <p className="text-sm flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{invite.plan.monthlyCredits} créditos/mês</p>
                <p className="text-lg font-bold">
                  {invite.amountCents > 0
                    ? `R$ ${(invite.amountCents / 100).toFixed(2)} / ${invite.billingCycle === "annual" ? "ano" : "mês"}`
                    : "Cortesia"}
                </p>
              </div>
            )}

            {stage === "form" && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  accept.mutate();
                }}
              >
                <div>
                  <Label>E-mail</Label>
                  <Input value={invite.email} disabled />
                </div>
                <div>
                  <Label>Defina sua senha</Label>
                  <Input
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={accept.isPending}>
                  {accept.isPending ? "Processando…" : invite.amountCents > 0 ? "Avançar para pagamento" : "Ativar conta"}
                </Button>
              </form>
            )}

            {stage === "pay" && !pix && (
              <Button onClick={() => pay.mutate()} disabled={pay.isPending} className="w-full" size="lg">
                {pay.isPending ? "Gerando PIX…" : "Gerar PIX para pagar"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!pix} onOpenChange={(o) => !o && setPix(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pague com PIX</DialogTitle>
            <DialogDescription>Aguardando confirmação…</DialogDescription>
          </DialogHeader>
          {pix && (
            <div className="space-y-4">
              <img src={`data:image/png;base64,${pix.qr}`} alt="QR PIX" className="mx-auto w-64 h-64" />
              <div>
                <Label>Copia e cola</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={pix.copy} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pix.copy);
                      toast.success("Copiado!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <a href={pix.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                Ver fatura no Asaas
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
