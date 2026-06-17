import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Flame, Check, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SalesPitch, CtaButton } from "@/components/sales/SalesPitch";
import { SiteFooter } from "@/components/sales/SiteFooter";
import { WhatsAppFloat } from "@/components/sales/WhatsAppFloat";

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
        content:
          "IA que atende seus clientes 24/7 no WhatsApp Web, com o tom da sua marca. Mensal via Pix, sem fidelidade.",
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
          <Link to="/" className="flex items-center">
            <Logo size={32} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <CtaButton size="sm">
              Quero começar agora <ArrowRight className="h-4 w-4" />
            </CtaButton>
          </div>
        </div>
      </header>

      {/* Hero vendas — mais agressivo */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Flame className="h-3 w-3" /> No seu WhatsApp atual — sem trocar de número, sem app novo
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Cada mensagem sem resposta é{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              dinheiro indo pro concorrente
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium text-primary">
            Uma extensão que coloca IA no seu WhatsApp Web — sem trocar de número, sem app novo.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            O cliente manda mensagem, ninguém responde em 5 minutos, ele já fechou com outro. A Argos
            responde na hora, 24 horas por dia, com o tom da sua empresa — enquanto você toca o
            negócio.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaButton>
              Quero parar de perder venda <ArrowRight className="h-4 w-4" />
            </CtaButton>
            <Button size="lg" variant="outline" asChild>
              <a href="#pricing">Ver planos</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            ✓ Ativação em minutos · ✓ Pix ou cartão · ✓ Sem fidelidade · ✓ Cancela quando quiser
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
                  <li key={i} className="flex gap-2">
                    <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    {i}
                  </li>
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
                  "Usa seu WhatsApp Web normal, só instala a extensão no Chrome",
                  "Você assume qualquer conversa quando quiser — a IA percebe e sai da frente",
                ].map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {i}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <SalesPitch variant="compact" />

      {/* FAQ vendas */}
      <section className="bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Perguntas frequentes</h2>
          </div>
          <div className="mx-auto mt-12 max-w-3xl space-y-4">
            {[
              {
                q: "Preciso trocar de número de WhatsApp?",
                a: "Não. Você usa seu número atual, dentro do WhatsApp Web que já conhece. É só cadastrar o número no painel.",
              },
              {
                q: "A IA responde do jeito da minha empresa?",
                a: "Sim. Você cadastra o tom de voz, os preços, as informações e as respostas certas — e pode até enviar arquivos. A IA usa tudo isso e fica mais natural quanto mais você ensina. Se não souber algo, ela não inventa: avisa que vai verificar e deixa a conversa para você assumir.",
              },
              {
                q: "E se eu quiser assumir a conversa?",
                a: "É só responder. A Argos percebe na hora, sai da frente e devolve o controle para você. Liga e desliga quando quiser, por contato.",
              },
              {
                q: "Como funciona o pagamento e o cancelamento?",
                a: "Assinatura mensal (ou anual com desconto) via Pix ou cartão, sem fidelidade. Você cancela quando quiser, sem multa nem ligação de retenção. Cada plano inclui créditos de IA por mês, e dá para comprar extras se precisar.",
              },
              {
                q: "Como crio minha conta?",
                a: "Direto pelo site: escolhe o plano, preenche seus dados, paga via Pix ou cartão e o acesso libera na hora em que o pagamento confirma. Leva poucos minutos.",
              },
              {
                q: "Como funciona o suporte?",
                a: "Por tickets no painel: você abre o chamado, nossa equipe responde e você recebe um aviso. Planos superiores têm prioridade na fila.",
              },
              {
                q: "É difícil de instalar? Funciona no celular?",
                a: "É uma extensão do Chrome que instala em poucos cliques — sem nada complicado. A IA roda no WhatsApp Web (no computador); as mensagens continuam chegando normalmente no seu celular. Para a IA ficar ativa, basta um computador ligado com o Chrome e o WhatsApp Web abertos. Conforme o plano, você pode usar mais de um computador e mais de um número.",
              },
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
          Pronto pra parar de perder venda?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          A ativação leva poucos minutos. A partir daí, nenhum cliente fica sem resposta.
        </p>
        <CtaButton className="mt-8">
          Quero começar agora <ArrowRight className="h-4 w-4" />
        </CtaButton>
      </section>

      <SiteFooter />
      <WhatsAppFloat />
    </div>
  );
}
