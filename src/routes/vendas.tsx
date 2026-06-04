import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Flame, Check, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SalesPitch } from "@/components/sales/SalesPitch";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Argos — A IA que vende no seu WhatsApp enquanto você foca no negócio" },
      {
        name: "description",
        content:
          "Página de vendas oficial da Argos. Veja como pequenas empresas faturam mais respondendo no WhatsApp em segundos, 24 horas por dia, com IA treinada no negócio.",
      },
      { property: "og:title", content: "Argos — Pare de perder venda no WhatsApp" },
      {
        property: "og:description",
        content: "IA que atende seus clientes 24/7 no WhatsApp Web, com o tom da sua marca. Sem cartão para começar.",
      },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center"><Logo size={32} /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" asChild>
              <Link to="/login">Quero começar agora <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero vendas — mais agressivo */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Flame className="h-3 w-3" /> Oferta de lançamento — primeiros 100 clientes
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Você está perdendo até <span className="text-primary">R$ 5.000/mês</span> em vendas no
            WhatsApp e nem percebe
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Cliente manda mensagem, ninguém responde em 5 minutos, ele já está conversando com o
            concorrente. A Argos resolve isso enquanto você toma café.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/login">Quero assinar agora <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            ✓ Setup em 5 minutos · ✓ Sem fidelidade · ✓ Cancela quando quiser
          </p>
        </div>
      </section>

      {/* Antes / depois */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Como é seu WhatsApp hoje vs. com a Argos
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <Card className="border-destructive/30">
            <CardContent className="pt-6">
              <h3 className="font-bold text-lg mb-4 text-destructive">Sem Argos</h3>
              <ul className="space-y-3 text-sm">
                {[
                  "Mensagens acumulam fora do horário",
                  "Equipe responde as mesmas coisas o dia inteiro",
                  "Cliente espera horas, vai pro concorrente",
                  "Você perde venda à noite e final de semana",
                  "Sobrecarga, atrasos, clientes irritados",
                ].map((i) => (
                  <li key={i} className="flex gap-2"><X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />{i}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-primary/50 shadow-lg">
            <CardContent className="pt-6">
              <h3 className="font-bold text-lg mb-4 text-primary">Com Argos</h3>
              <ul className="space-y-3 text-sm">
                {[
                  "IA responde em segundos, 24 horas por dia",
                  "Equipe foca em casos complexos e vendas grandes",
                  "Cliente recebe atenção na hora e fecha contigo",
                  "Vende dormindo, no domingo e no feriado",
                  "Atendimento profissional, sem caos",
                ].map((i) => (
                  <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{i}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <SalesPitch variant="full" />

      {/* FAQ vendas */}
      <section className="bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Perguntas frequentes</h2>
          </div>
          <div className="mx-auto mt-12 max-w-3xl space-y-4">
            {[
              { q: "Preciso trocar de número de WhatsApp?", a: "Não. A Argos funciona com seu número atual, dentro do WhatsApp Web que você já usa." },
              { q: "A IA responde do jeito da minha empresa?", a: "Sim. Você cadastra o tom, as informações e as respostas certas. A IA usa tudo isso. Quanto mais você ensina, mais natural fica." },
              { q: "E se eu quiser assumir a conversa?", a: "É só responder. A Argos entende e devolve o controle para você. Liga e desliga quando quiser." },
              { q: "Funciona no celular?", a: "A IA roda no WhatsApp Web (computador). As mensagens chegam normalmente no celular, mas é o desktop que mantém ela ativa." },
              { q: "Posso cancelar a qualquer momento?", a: "Pode. Sem multa, sem fidelidade, sem ligação de retenção. Um clique e acabou." },
            ].map((f) => (
              <details key={f.q} className="rounded-lg border bg-background p-4 group">
                <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-primary group-open:rotate-45 transition">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final reforçado */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
          Pronto pra parar de perder dinheiro?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Em 5 minutos sua IA está ativa. Em 1 dia você sente a diferença no caixa.
        </p>
        <Button size="lg" className="mt-8" asChild>
          <Link to="/login">Quero assinar agora <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </section>

      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
          <Logo size={28} className="text-sm" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Argos. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
