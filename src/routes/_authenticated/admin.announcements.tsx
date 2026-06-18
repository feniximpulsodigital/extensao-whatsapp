import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  adminGetAnnouncement,
  adminSaveAnnouncement,
  adminClearAnnouncement,
} from "@/lib/announcements.functions";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  component: AnnouncementsPage,
});

const LEVELS: Record<string, { label: string; cls: string }> = {
  info: { label: "Informação", cls: "border-primary/40 bg-primary/5" },
  warning: { label: "Atenção", cls: "border-amber-500/50 bg-amber-500/10" },
  critical: { label: "Crítico", cls: "border-destructive/50 bg-destructive/10" },
};

function AnnouncementsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetAnnouncement);
  const saveFn = useServerFn(adminSaveAnnouncement);
  const clearFn = useServerFn(adminClearAnnouncement);

  const { data: current } = useQuery({
    queryKey: ["admin-announcement"],
    queryFn: () => getFn(),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<"info" | "warning" | "critical">("info");

  useEffect(() => {
    if (current && current.is_active) {
      setTitle(current.title ?? "");
      setBody(current.body ?? "");
      setLevel((current.level as "info" | "warning" | "critical") ?? "info");
    }
  }, [current]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { title: title || undefined, body, level, isActive: true } }),
    onSuccess: () => {
      toast.success("Aviso publicado para todos os clientes.");
      qc.invalidateQueries({ queryKey: ["admin-announcement"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      toast.success("Aviso desativado.");
      setTitle("");
      setBody("");
      setLevel("info");
      qc.invalidateQueries({ queryKey: ["admin-announcement"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = current?.is_active ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Megaphone className="h-6 w-6 text-primary" /> Avisos
        </h2>
        <p className="text-muted-foreground">
          Escreva um comunicado que aparece para <strong>todos os clientes</strong> — no painel e na
          extensão (WhatsApp Web). Fica ativo até você trocar ou desativar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Escrever aviso</CardTitle>
            <CardDescription>
              {active ? "Há um aviso ativo. Edite e publique para substituir." : "Nenhum aviso ativo no momento."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-title">Título (opcional)</Label>
              <Input
                id="a-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Manutenção programada"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-body">Mensagem</Label>
              <Textarea
                id="a-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                placeholder="Escreva o que deve aparecer para todos os clientes…"
              />
            </div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={level} onValueChange={(v: "info" | "warning" | "critical") => setLevel(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informação (azul/verde)</SelectItem>
                  <SelectItem value="warning">Atenção (amarelo)</SelectItem>
                  <SelectItem value="critical">Crítico (vermelho)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending || body.trim().length === 0}>
                {save.isPending ? "Publicando…" : active ? "Atualizar aviso" : "Publicar aviso"}
              </Button>
              {active && (
                <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>
                  Desativar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            <CardDescription>É assim que o cliente vê o aviso.</CardDescription>
          </CardHeader>
          <CardContent>
            {body.trim().length === 0 ? (
              <p className="text-sm text-muted-foreground">Escreva uma mensagem para ver a prévia.</p>
            ) : (
              <div className={`flex items-start gap-3 rounded-lg border p-4 ${LEVELS[level].cls}`}>
                {level === "info" ? (
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <AlertTriangle
                    className={`mt-0.5 h-5 w-5 shrink-0 ${level === "critical" ? "text-destructive" : "text-amber-600"}`}
                  />
                )}
                <div className="min-w-0">
                  {title && <p className="font-semibold">{title}</p>}
                  <p className="whitespace-pre-wrap text-sm">{body}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
