import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Copy, Zap } from "lucide-react";
import { toast } from "sonner";
import { listMyCreditPackages, buyCreditPackagePix } from "@/lib/ai-credits.functions";
import { checkPaymentStatus } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/buy-credits")({
  head: () => ({ meta: [{ title: "Comprar créditos — Argos" }] }),
  component: BuyCreditsPage,
});

function BuyCreditsPage() {
  const listFn = useServerFn(listMyCreditPackages);
  const buyFn = useServerFn(buyCreditPackagePix);
  const checkFn = useServerFn(checkPaymentStatus);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: pkgs, isLoading } = useQuery({ queryKey: ["my-pkgs"], queryFn: () => listFn() });
  const [pix, setPix] = useState<{ paymentId: string; qr: string; copy: string; invoiceUrl: string } | null>(null);

  const buy = useMutation({
    mutationFn: (id: string) => buyFn({ data: { packageId: id } }),
    onSuccess: (r) => setPix({ paymentId: r.paymentId, qr: r.pixQrCode, copy: r.pixCopyPaste, invoiceUrl: r.invoiceUrl }),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!pix) return;
    const i = setInterval(async () => {
      try {
        const r = await checkFn({ data: { paymentId: pix.paymentId } });
        if (r.status === "confirmed" || r.status === "received") {
          clearInterval(i);
          toast.success("Créditos adicionados!");
          qc.invalidateQueries({ queryKey: ["credits-summary"] });
          qc.invalidateQueries({ queryKey: ["my-tenant"] });
          navigate({ to: "/dashboard", replace: true });
        }
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(i);
  }, [pix, checkFn, qc, navigate]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto max-w-5xl p-6 space-y-6">
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link></Button>
        <div className="text-center">
          <h1 className="text-3xl font-bold">Comprar créditos</h1>
          <p className="text-muted-foreground">Escolha um pacote e pague com PIX</p>
        </div>

        {isLoading ? <p className="text-center">Carregando…</p> : !pkgs || pkgs.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhum pacote disponível no momento.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {pkgs.map((p: any) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />{p.name}</CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-3xl font-bold">R$ {(p.price_cents/100).toFixed(2)}</div>
                  <p className="text-sm">{p.credits} créditos{p.bonus_credits > 0 && <span className="text-primary"> + {p.bonus_credits} bônus</span>}</p>
                  <Button className="w-full" onClick={() => buy.mutate(p.id)} disabled={buy.isPending}>
                    {buy.isPending ? "Gerando PIX…" : "Comprar com PIX"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(pix.copy); toast.success("Copiado!"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <a href={pix.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Ver fatura no Asaas</a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
