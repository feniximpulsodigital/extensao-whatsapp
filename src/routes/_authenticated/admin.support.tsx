import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Star } from "lucide-react";
import { toast } from "sonner";
import {
  adminListTickets,
  adminGetTicket,
  adminReplyTicket,
  adminCloseTicket,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: AdminSupportPage,
});

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  open: { label: "Aguardando você", variant: "secondary" },
  answered: { label: "Aguardando cliente", variant: "default" },
  closed: { label: "Encerrado", variant: "outline" },
};

function AdminSupportPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListTickets);
  const getFn = useServerFn(adminGetTicket);
  const replyFn = useServerFn(adminReplyTicket);
  const closeFn = useServerFn(adminCloseTicket);

  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => listFn(),
    refetchInterval: 20_000,
  });
  const { data: thread } = useQuery({
    queryKey: ["admin-ticket", selected],
    queryFn: () => getFn({ data: { ticketId: selected! } }),
    enabled: !!selected,
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    qc.invalidateQueries({ queryKey: ["admin-support-badge"] });
    if (selected) qc.invalidateQueries({ queryKey: ["admin-ticket", selected] });
  };

  const sendReply = useMutation({
    mutationFn: (close: boolean) =>
      replyFn({ data: { ticketId: selected!, message: reply, close } }),
    onSuccess: () => {
      toast.success("Resposta enviada.");
      setReply("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: () => closeFn({ data: { ticketId: selected! } }),
    onSuccess: () => {
      toast.success("Ticket encerrado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const maxPriority = Math.max(1, ...(tickets ?? []).map((t) => t.priority));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Suporte</h2>
        <p className="text-muted-foreground">
          Fila ordenada por prioridade do plano — clientes de planos maiores aparecem primeiro.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-2">
          {!tickets?.length ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Nenhum ticket.
              </CardContent>
            </Card>
          ) : (
            tickets.map((t) => {
              const st = STATUS_LABEL[t.status] ?? STATUS_LABEL.open;
              const tenant = t.tenants as {
                company_name: string;
                plans: { name: string } | null;
              } | null;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/60 ${
                    selected === t.id ? "border-primary bg-muted/60" : "bg-background"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{t.subject}</p>
                    {t.priority >= maxPriority && maxPriority > 1 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                        <Star className="h-3 w-3" />
                        Prioritário
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tenant?.company_name ?? "—"}
                    {tenant?.plans?.name ? ` · ${tenant.plans.name}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.last_message_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div>
          {!selected || !thread ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Selecione um ticket para responder.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{thread.ticket.subject}</CardTitle>
                  <CardDescription>
                    {(() => {
                      const tenant = thread.ticket.tenants as {
                        company_name: string;
                        whatsapp_numbers: string[] | null;
                        plans: { name: string } | null;
                      } | null;
                      return (
                        <>
                          {tenant?.company_name ?? "—"}
                          {tenant?.plans?.name ? ` · Plano ${tenant.plans.name}` : ""}
                          {tenant?.whatsapp_numbers?.length
                            ? ` · WhatsApp ${tenant.whatsapp_numbers.join(", ")}`
                            : ""}
                        </>
                      );
                    })()}
                  </CardDescription>
                </div>
                {thread.ticket.status !== "closed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => close.mutate()}
                    disabled={close.isPending}
                  >
                    Encerrar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {thread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          m.sender === "admin" ? "bg-primary/15" : "border bg-muted/40"
                        }`}
                      >
                        <p className="text-xs font-semibold text-muted-foreground">
                          {m.sender === "admin" ? "Você (suporte)" : "Cliente"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-right text-[10px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {thread.ticket.status === "closed" ? (
                  <p className="text-sm text-muted-foreground">Ticket encerrado.</p>
                ) : (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (reply.trim()) sendReply.mutate(false);
                    }}
                  >
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Escreva a resposta..."
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={sendReply.isPending || !reply.trim()}>
                        <Send className="h-4 w-4 mr-1" />
                        Responder
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={sendReply.isPending || !reply.trim()}
                        onClick={() => sendReply.mutate(true)}
                      >
                        Responder e encerrar
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
