import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, LifeBuoy, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  createMyTicket,
  listMyTickets,
  getMyTicket,
  replyMyTicket,
  closeMyTicket,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Suporte — Argos" }] }),
  component: SupportPage,
  errorComponent: ({ error }) => <div className="p-6">Erro: {error.message}</div>,
});

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  open: { label: "Aguardando resposta", variant: "secondary" },
  answered: { label: "Respondido", variant: "default" },
  closed: { label: "Encerrado", variant: "outline" },
};

function SupportPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyTickets);
  const getFn = useServerFn(getMyTicket);
  const createFn = useServerFn(createMyTicket);
  const replyFn = useServerFn(replyMyTicket);
  const closeFn = useServerFn(closeMyTicket);

  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  const { data: tickets } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => listFn(),
    refetchInterval: 20_000,
  });
  const { data: thread } = useQuery({
    queryKey: ["my-ticket", selected],
    queryFn: () => getFn({ data: { ticketId: selected! } }),
    enabled: !!selected,
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-tickets"] });
    qc.invalidateQueries({ queryKey: ["support-badge"] });
    if (selected) qc.invalidateQueries({ queryKey: ["my-ticket", selected] });
  };

  const create = useMutation({
    mutationFn: () => createFn({ data: { subject, message } }),
    onSuccess: (r) => {
      toast.success("Ticket aberto! Nossa equipe vai responder em breve.");
      setCreating(false);
      setSubject("");
      setMessage("");
      setSelected(r.ticketId);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendReply = useMutation({
    mutationFn: () => replyFn({ data: { ticketId: selected!, message: reply } }),
    onSuccess: () => {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center">
            <Logo size={32} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar ao painel
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <LifeBuoy className="h-7 w-7 text-primary" />
              Suporte
            </h1>
            <p className="text-muted-foreground">
              Abra um ticket e acompanhe as respostas por aqui. Planos superiores têm prioridade na
              fila.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo ticket
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-2">
            {!tickets?.length ? (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  Nenhum ticket ainda. Precisa de ajuda? Abra o primeiro.
                </CardContent>
              </Card>
            ) : (
              tickets.map((t) => {
                const st = STATUS_LABEL[t.status] ?? STATUS_LABEL.open;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/60 ${
                      selected === t.id ? "border-primary bg-muted/60" : "bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-tight">{t.subject}</p>
                      {t.unread > 0 && (
                        <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                          {t.unread}
                        </span>
                      )}
                    </div>
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
                  Selecione um ticket ao lado para ver a conversa.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">{thread.ticket.subject}</CardTitle>
                    <CardDescription>
                      Aberto em {new Date(thread.ticket.created_at).toLocaleDateString("pt-BR")}
                    </CardDescription>
                  </div>
                  {thread.ticket.status !== "closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => close.mutate()}
                      disabled={close.isPending}
                    >
                      Encerrar ticket
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {thread.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.sender === "client" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            m.sender === "client" ? "bg-primary/15" : "border bg-muted/40"
                          }`}
                        >
                          <p className="text-xs font-semibold text-muted-foreground">
                            {m.sender === "client" ? "Você" : "Suporte Argos"}
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
                    <p className="text-sm text-muted-foreground">
                      Este ticket foi encerrado. Se precisar de mais ajuda, abra um novo.
                    </p>
                  ) : (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (reply.trim()) sendReply.mutate();
                      }}
                    >
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Escreva sua mensagem..."
                        rows={2}
                        className="flex-1"
                      />
                      <Button type="submit" disabled={sendReply.isPending || !reply.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo ticket de suporte</DialogTitle>
            <DialogDescription>
              Descreva o problema ou a dúvida. Nossa equipe responde por aqui e você recebe um aviso
              no painel.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="t-subject">Assunto</Label>
              <Input
                id="t-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-message">Mensagem</Label>
              <Textarea
                id="t-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={5}
              />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? "Enviando..." : "Abrir ticket"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
