import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminGetPricingConfig,
  adminUpdatePricingConfig,
  adminListCreditPackages,
  adminUpsertCreditPackage,
  adminDeleteCreditPackage,
} from "@/lib/ai-credits.functions";

export const Route = createFileRoute("/_authenticated/admin/ai-credits")({
  component: AiCreditsPage,
});

function AiCreditsPage() {
  const getCfg = useServerFn(adminGetPricingConfig);
  const updCfg = useServerFn(adminUpdatePricingConfig);
  const listPkg = useServerFn(adminListCreditPackages);
  const upsertPkg = useServerFn(adminUpsertCreditPackage);
  const delPkg = useServerFn(adminDeleteCreditPackage);
  const qc = useQueryClient();

  const { data: cfg } = useQuery({ queryKey: ["pricing-config"], queryFn: () => getCfg() });
  const { data: pkgs } = useQuery({ queryKey: ["credit-pkgs"], queryFn: () => listPkg() });

  const [form, setForm] = useState({
    usd_to_brl: 5.2,
    credits_per_usd: 1000,
    global_markup_multiplier: 2.5,
    model_cost_overrides: "{}",
  });
  useEffect(() => {
    if (cfg) setForm({
      usd_to_brl: Number(cfg.usd_to_brl),
      credits_per_usd: cfg.credits_per_usd,
      global_markup_multiplier: Number(cfg.global_markup_multiplier),
      model_cost_overrides: JSON.stringify(cfg.model_cost_overrides ?? {}, null, 2),
    });
  }, [cfg]);

  const saveCfg = useMutation({
    mutationFn: () => {
      let models: any;
      try { models = JSON.parse(form.model_cost_overrides); } catch { throw new Error("JSON de modelos inválido"); }
      return updCfg({ data: {
        usd_to_brl: form.usd_to_brl,
        credits_per_usd: form.credits_per_usd,
        global_markup_multiplier: form.global_markup_multiplier,
        model_cost_overrides: models,
      }});
    },
    onSuccess: () => { toast.success("Configuração salva"); qc.invalidateQueries({ queryKey: ["pricing-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const savePkg = useMutation({
    mutationFn: () => upsertPkg({ data: {
      id: editing.id || undefined,
      name: editing.name, description: editing.description || null,
      credits: editing.credits, bonus_credits: editing.bonus_credits ?? 0,
      price_cents: editing.price_cents,
      markup_multiplier: editing.markup_multiplier || null,
      is_active: editing.is_active ?? true, sort_order: editing.sort_order ?? 0,
    }}),
    onSuccess: () => { toast.success("Pacote salvo"); qc.invalidateQueries({ queryKey: ["credit-pkgs"] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removePkg = useMutation({
    mutationFn: (id: string) => delPkg({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["credit-pkgs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de pricing da IA</CardTitle>
          <CardDescription>
            Internamente o sistema calcula custo real em USD por chamada e debita créditos do cliente
            com a margem definida. O cliente vê apenas “créditos abstratos”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>USD → BRL</Label><Input type="number" step="0.01" value={form.usd_to_brl} onChange={(e) => setForm({ ...form, usd_to_brl: parseFloat(e.target.value || "0") })} /></div>
            <div><Label>Créditos por 1 USD (custo)</Label><Input type="number" value={form.credits_per_usd} onChange={(e) => setForm({ ...form, credits_per_usd: parseInt(e.target.value || "0") })} /></div>
            <div><Label>Markup global (x)</Label><Input type="number" step="0.1" value={form.global_markup_multiplier} onChange={(e) => setForm({ ...form, global_markup_multiplier: parseFloat(e.target.value || "0") })} /></div>
          </div>
          <div>
            <Label>Custos por modelo (JSON: input_per_1k / output_per_1k em USD)</Label>
            <textarea
              className="w-full font-mono text-sm rounded-md border bg-background p-2 min-h-[160px]"
              value={form.model_cost_overrides}
              onChange={(e) => setForm({ ...form, model_cost_overrides: e.target.value })}
            />
          </div>
          <Button onClick={() => saveCfg.mutate()} disabled={saveCfg.isPending}>{saveCfg.isPending ? "Salvando…" : "Salvar configuração"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pacotes de créditos</CardTitle>
              <CardDescription>Preço, quantidade e bônus que o cliente vê na compra avulsa</CardDescription>
            </div>
            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing({ name: "", description: "", credits: 1000, bonus_credits: 0, price_cents: 0, is_active: true, sort_order: 0 })}>
                  <Plus className="h-4 w-4 mr-2" />Novo pacote
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing?.id ? "Editar pacote" : "Novo pacote"}</DialogTitle></DialogHeader>
                {editing && (
                  <div className="space-y-3">
                    <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                    <div><Label>Descrição</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Créditos</Label><Input type="number" value={editing.credits} onChange={(e) => setEditing({ ...editing, credits: parseInt(e.target.value || "0") })} /></div>
                      <div><Label>Bônus</Label><Input type="number" value={editing.bonus_credits ?? 0} onChange={(e) => setEditing({ ...editing, bonus_credits: parseInt(e.target.value || "0") })} /></div>
                      <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={(editing.price_cents/100).toFixed(2)} onChange={(e) => setEditing({ ...editing, price_cents: Math.round(parseFloat(e.target.value || "0")*100) })} /></div>
                      <div><Label>Markup específico (opcional)</Label><Input type="number" step="0.1" value={editing.markup_multiplier ?? ""} onChange={(e) => setEditing({ ...editing, markup_multiplier: e.target.value ? parseFloat(e.target.value) : null })} /></div>
                      <div><Label>Ordem</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || "0") })} /></div>
                      <div className="flex items-center gap-2 pt-6"><Switch checked={editing.is_active ?? true} onCheckedChange={(c) => setEditing({ ...editing, is_active: c })} /><Label>Ativo</Label></div>
                    </div>
                    <DialogFooter><Button onClick={() => savePkg.mutate()} disabled={savePkg.isPending}>{savePkg.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(pkgs ?? []).map((p: any) => (
              <Card key={p.id} className={p.is_active ? "" : "opacity-60"}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {p.name}
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) removePkg.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>{p.credits} créditos{p.bonus_credits ? ` + ${p.bonus_credits} bônus` : ""}</div>
                  <div className="text-lg font-bold">R$ {(p.price_cents/100).toFixed(2)}</div>
                </CardContent>
              </Card>
            ))}
            {(pkgs ?? []).length === 0 && <p className="text-muted-foreground">Nenhum pacote cadastrado.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
