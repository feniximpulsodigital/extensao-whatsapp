import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminListPlans, adminUpsertPlan, adminDeletePlan } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  component: PlansPage,
});

type PlanForm = {
  id?: string;
  name: string;
  description: string;
  price_cents: number;
  price_cents_annual: number;
  monthly_credits: number;
  max_knowledge_entries: number;
  max_devices: number | null;
  max_numbers: number | null;
  support_priority: number;
  is_active: boolean;
  is_custom: boolean;
  sort_order: number;
};

const empty: PlanForm = {
  name: "",
  description: "",
  price_cents: 0,
  price_cents_annual: 0,
  monthly_credits: 0,
  max_knowledge_entries: 100,
  max_devices: null,
  max_numbers: 1,
  support_priority: 1,
  is_active: true,
  is_custom: false,
  sort_order: 0,
};

function PlansPage() {
  const list = useServerFn(adminListPlans);
  const upsert = useServerFn(adminUpsertPlan);
  const del = useServerFn(adminDeletePlan);
  const qc = useQueryClient();

  const { data: plans, isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: () => list() });
  const [editing, setEditing] = useState<PlanForm | null>(null);

  const saveMut = useMutation({
    mutationFn: (f: PlanForm) =>
      upsert({
        data: {
          ...(f.id ? { id: f.id } : {}),
          name: f.name,
          description: f.description || null,
          price_cents: f.price_cents,
          price_cents_annual: f.price_cents_annual,
          monthly_credits: f.monthly_credits,
          max_knowledge_entries: f.max_knowledge_entries,
          max_devices: f.max_devices,
          max_numbers: f.max_numbers,
          support_priority: f.support_priority,
          is_active: f.is_active,
          is_custom: f.is_custom,
          sort_order: f.sort_order,
        },
      }),
    onSuccess: () => {
      toast.success("Plano salvo");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Plano removido");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Planos</h2>
          <p className="text-muted-foreground">Configure preços mensais e anuais</p>
        </div>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ ...empty })}>
              <Plus className="h-4 w-4 mr-2" />
              Novo plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <PlanFormEditor
                form={editing}
                onChange={setEditing}
                onSave={() => saveMut.mutate(editing)}
                saving={saveMut.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p>Carregando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans?.map((p) => (
            <Card key={p.id} className={p.is_active ? "" : "opacity-60"}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p as PlanForm)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este plano?")) delMut.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div>
                  Mensal: <strong>R$ {(p.price_cents / 100).toFixed(2)}</strong>
                </div>
                <div>
                  Anual: <strong>R$ {((p.price_cents_annual ?? 0) / 100).toFixed(2)}</strong>
                </div>
                <div>Créditos/mês: {p.monthly_credits}</div>
                <div>Base de conhecimento: {p.max_knowledge_entries}</div>
                <div>Computadores: {p.max_devices ?? "ilimitado"}</div>
                <div>Números WhatsApp: {p.max_numbers ?? "ilimitado"}</div>
                <div>Prioridade de suporte: {p.support_priority}</div>
                <div>Status: {p.is_active ? "Ativo" : "Inativo"}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanFormEditor({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: PlanForm;
  onChange: (f: PlanForm) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Nome</Label>
        <Input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>Descrição</Label>
        <Input
          value={form.description ?? ""}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Preço mensal (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={(form.price_cents / 100).toString()}
            onChange={(e) =>
              onChange({
                ...form,
                price_cents: Math.round(parseFloat(e.target.value || "0") * 100),
              })
            }
          />
        </div>
        <div>
          <Label>Preço anual (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={(form.price_cents_annual / 100).toString()}
            onChange={(e) =>
              onChange({
                ...form,
                price_cents_annual: Math.round(parseFloat(e.target.value || "0") * 100),
              })
            }
          />
        </div>
        <div>
          <Label>Créditos/mês</Label>
          <Input
            type="number"
            value={form.monthly_credits}
            onChange={(e) =>
              onChange({ ...form, monthly_credits: parseInt(e.target.value || "0") })
            }
          />
        </div>
        <div>
          <Label>Máx. entradas KB</Label>
          <Input
            type="number"
            value={form.max_knowledge_entries}
            onChange={(e) =>
              onChange({ ...form, max_knowledge_entries: parseInt(e.target.value || "0") })
            }
          />
        </div>
        <div>
          <Label>Máx. computadores (vazio = ilimitado)</Label>
          <Input
            type="number"
            min={1}
            value={form.max_devices ?? ""}
            onChange={(e) =>
              onChange({ ...form, max_devices: e.target.value ? parseInt(e.target.value) : null })
            }
          />
        </div>
        <div>
          <Label>Máx. números WhatsApp (vazio = ilimitado)</Label>
          <Input
            type="number"
            min={1}
            value={form.max_numbers ?? ""}
            onChange={(e) =>
              onChange({ ...form, max_numbers: e.target.value ? parseInt(e.target.value) : null })
            }
          />
        </div>
        <div>
          <Label>Prioridade de suporte (maior = mais rápido)</Label>
          <Input
            type="number"
            min={1}
            value={form.support_priority}
            onChange={(e) =>
              onChange({ ...form, support_priority: parseInt(e.target.value || "1") })
            }
          />
        </div>
        <div>
          <Label>Ordem</Label>
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) => onChange({ ...form, sort_order: parseInt(e.target.value || "0") })}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch
            checked={form.is_active}
            onCheckedChange={(c) => onChange({ ...form, is_active: c })}
          />
          <Label>Ativo</Label>
        </div>
        <div className="flex items-center gap-2 pt-6 col-span-2">
          <Switch
            checked={form.is_custom}
            onCheckedChange={(c) => onChange({ ...form, is_custom: c })}
          />
          <Label>Plano custom (oculto do checkout público — só atribuído por convite)</Label>
        </div>
      </div>
      <Button onClick={onSave} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}
