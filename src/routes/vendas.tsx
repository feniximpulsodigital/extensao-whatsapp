import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Flame, Check, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SalesPitch, CtaButton } from "@/components/sales/SalesPitch";
import { WhatsAppDemo } from "@/components/sales/WhatsAppDemo";
import { SiteFooter } from "@/components/sales/SiteFooter";

// A página de vendas tem um único tema (claro): fundos brancos fazem os blocos
// verdes (hero, faixas, CTA) estourarem com o máximo de contraste e dão a cara
// de produto sério/confiável que converte. Travamos o tema enquanto a vendas
// está montada e restauramos a preferência do visitante ao sair.
function useLockedLightTheme() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    root.classList.add("light");
    return () => {
      if (hadDark) {
        root.classList.remove("light");
        root.classList.add("dark");
      }
    };
  }, []);
}

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
          "IA que atende seus clientes 24 horas no WhatsApp Web, com o tom da sua marca. Mensal via Pix, sem fidelidade.",
      },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  useLockedLightTheme();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center">
            <Logo size={32} />
          </Link>
          <div className="flex items-center gap-2">
            <CtaButton size="sm">
              Quero começar agora <ArrowRight className="h-4 w-4" />
            </CtaButton>
          </div>
        </div>
      </header>

      {/* Hero vendas — bloco escuro com verde, alto contraste.
          Promessa no título, dor no subtítulo, prova visual (mockup) ao lado. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-primary to-emerald-800 text-white">
        <div className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-emerald-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="container relative mx-auto grid items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur">
              <Flame className="h-3.5 w-3.5 text-emerald-300" /> No seu WhatsApp atual — sem trocar de
              número, sem app novo
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl xl:text-6xl">
              Sua IA respondendo cada cliente em segundos,{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-white bg-clip-text text-transparent">
                24 horas por dia
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/80 lg:mx-0">
              Quem responde primeiro leva a venda. A Argos atende na hora, com o tom da sua empresa —
              de madrugada, no feriado e no fim de semana — enquanto você toca o negócio. Nenhum
              cliente fica mais no vácuo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button size="lg" variant="secondary" className="font-semibold shadow-lg" asChild>
                <Link to="/assinar" search={{ plan: undefined }}>
                  Quero começar agora <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <a href="#pricing">Ver planos</a>
              </Button>
            </div>
            <p className="mt-5 text-xs text-white/70">
              ✓ Ativação em minutos · ✓ Pix ou cartão · ✓ Sem fidelidade · ✓ Cancela quando quiser
            </p>
          </div>

          {/* Prova visual: a conversa acontecendo.
              Envolto num cartão claro para isolar o text-white do hero — sem
              ele os balões do cliente e a legenda ficariam invisíveis. */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-emerald-300/20 blur-2xl" />
            <div className="relative rounded-2xl bg-background p-3 text-foreground shadow-2xl">
              <WhatsAppDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Antes / depois */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            O que muda no seu WhatsApp a partir de hoje
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-destructive">
              <X className="h-5 w-5" /> Sem Argos
            </h3>
            <ul className="space-y-3 text-sm">
              {[
                "Mensagens acumulam fora do horário",
                "Equipe responde as mesmas coisas o dia inteiro",
                "Cliente espera horas, vai pro concorrente",
                "Você perde venda à noite e final de semana",
                "Sobrecarga, atrasos, clientes irritados",
              ].map((i) => (
                <li key={i} className="flex gap-2">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-emerald-700 p-6 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <Check className="h-5 w-5 text-emerald-200" /> Com Argos
            </h3>
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
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10 text-center">
          <CtaButton size="lg">
            Quero esse resultado <ArrowRight className="h-4 w-4" />
          </CtaButton>
        </div>
      </section>

      <SalesPitch variant="compact" />

      {/* FAQ vendas */}
      <section id="faq" className="bg-muted/40 py-20">
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
                a: "É só responder — a IA detecta que você entrou e se retira automaticamente. Você liga e desliga quando quiser, por contato.",
              },
              {
                q: "Como funciona o pagamento e o cancelamento?",
                a: "Assinatura mensal (ou anual com desconto) via Pix ou cartão, sem fidelidade. Você cancela quando quiser, sem multa nem ligação de retenção. Cada plano inclui créditos de IA por mês, e dá para comprar extras se precisar.",
              },
              {
                q: "E se eu não gostar? Tem garantia?",
                a: "Tem. Você tem 7 dias de garantia a partir do início da assinatura: é só clicar em “Solicitar reembolso” no seu painel (no card de garantia) que nossa equipe processa a devolução e entra em contato. Sem burocracia.",
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
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-primary to-emerald-800 py-20 text-center text-white">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="container relative mx-auto px-4">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            Pronto pra parar de perder venda?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            A ativação leva poucos minutos. A partir daí, nenhum cliente fica sem resposta.
          </p>
          <Button size="lg" variant="secondary" className="mt-8 font-semibold shadow-lg" asChild>
            <Link to="/assinar" search={{ plan: undefined }}>
              Quero começar agora <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-white/70">Sem fidelidade · Cancele quando quiser</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
