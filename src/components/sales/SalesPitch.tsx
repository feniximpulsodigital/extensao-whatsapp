import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare,
  Clock,
  TrendingDown,
  Frown,
  Check,
  ArrowRight,
  Sparkles,
  Brain,
  Shield,
  Zap,
  Users,
  BadgeCheck,
  Rocket,
  Monitor,
  UtensilsCrossed,
  CalendarClock,
  Store,
} from "lucide-react";
import { ShieldCheck, Gift, HeartHandshake, UserCheck, Star } from "lucide-react";
import { getPublicPlans } from "@/lib/plans.functions";
import { WhatsAppDemo } from "@/components/sales/WhatsAppDemo";
import { TESTIMONIALS, SOCIAL_PROOF_STAT, GUARANTEE_DAYS, WELCOME_BONUS } from "@/components/sales/sales-config";

// CTA principal do site: leva ao cadastro self-service (/assinar).
// Com planId, o plano já chega pré-selecionado no cadastro e no checkout.
export function CtaButton({
  children,
  size = "lg",
  variant = "default",
  className,
  planId,
}: {
  children: ReactNode;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
  className?: string;
  planId?: string;
}) {
  return (
    <Button size={size} variant={variant} className={className} asChild>
      <Link to="/assinar" search={{ plan: planId }}>
        {children}
      </Link>
    </Button>
  );
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  });
}

type PlanForPricing = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  priceCentsAnnual: number;
  monthlyCredits: number;
  features: string[];
  highlight: boolean;
};

// Desconto anual vs. 12x o mensal (ex.: 17% = "2 meses grátis").
function annualDiscountPct(monthly: number, annual: number) {
  if (!monthly || !annual) return 0;
  const full = monthly * 12;
  if (annual >= full) return 0;
  return Math.round(((full - annual) / full) * 100);
}

function PricingSection({
  plans,
  isLoading,
  isError,
}: {
  plans: PlanForPricing[];
  isLoading: boolean;
  isError: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  // só oferece o toggle anual se ao menos um plano tem preço anual configurado
  const hasAnnual = plans.some((p) => p.priceCentsAnnual > 0);

  return (
    <section id="pricing" className="bg-muted/40 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">Planos</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Cabe no bolso. Paga sozinho na primeira venda extra.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Pix ou cartão · Sem fidelidade · Cancele quando quiser
          </p>
        </div>

        {hasAnnual && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                cycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-bold text-green-600 dark:text-green-400">
                economize
              </span>
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Carregando planos…</p>
        ) : isError || plans.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os planos agora. Crie sua conta e escolha o plano na etapa de
              pagamento.
            </p>
            <CtaButton className="mt-6">
              Criar minha conta <ArrowRight className="h-4 w-4" />
            </CtaButton>
          </div>
        ) : (
          <div
            className={`mx-auto mt-10 grid max-w-5xl items-start gap-6 ${plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
          >
            {plans.map((p) => {
              const annual = p.priceCentsAnnual > 0;
              const showAnnual = cycle === "annual" && annual;
              const price = showAnnual ? p.priceCentsAnnual : p.priceCents;
              const perMonthEquivalent = showAnnual ? Math.round(p.priceCentsAnnual / 12) : p.priceCents;
              const discount = annualDiscountPct(p.priceCents, p.priceCentsAnnual);
              return (
                <Card
                  key={p.id}
                  className={p.highlight ? "border-primary shadow-lg relative md:-mt-2" : "relative"}
                >
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Mais escolhido
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    {p.description && <CardDescription>{p.description}</CardDescription>}
                    {showAnnual ? (
                      <>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{formatBRL(perMonthEquivalent)}</span>
                          <span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatBRL(p.priceCentsAnnual)} à vista no plano anual
                          {discount > 0 && (
                            <span className="ml-1 font-semibold text-green-600 dark:text-green-400">
                              · economize {discount}%
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{formatBRL(p.priceCents)}</span>
                          <span className="text-sm font-normal text-muted-foreground">/mês</span>
                        </div>
                        {annual && discount > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            ou {formatBRL(Math.round(p.priceCentsAnnual / 12))}/mês no anual
                            <span className="ml-1 font-semibold text-green-600 dark:text-green-400">
                              (−{discount}%)
                            </span>
                          </p>
                        )}
                      </>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {p.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" /> {feat}
                        </li>
                      ))}
                    </ul>
                    <CtaButton
                      className="mt-6 w-full"
                      size="default"
                      variant={p.highlight ? "default" : "outline"}
                      planId={p.id}
                    >
                      Assinar este plano <ArrowRight className="h-4 w-4" />
                    </CtaButton>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-muted-foreground">
          Todos os planos incluem IA 24/7, transcrição de áudios e suporte humano. Sem taxa de setup.
          Comece hoje e cancele quando quiser.
        </p>
      </div>
    </section>
  );
}

export function SalesPitch({ variant = "full" }: { variant?: "full" | "compact" }) {
  const fetchPlans = useServerFn(getPublicPlans);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => fetchPlans(),
    staleTime: 5 * 60 * 1000,
  });
  const plans = data?.plans ?? [];

  return (
    <>
      {/* Dor / problema */}
      <section id="problemas" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            O problema
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Cada mensagem sem resposta é um cliente que vai para o concorrente
          </h2>
          <p className="mt-4 text-muted-foreground">
            Você sabe que precisa responder rápido. Mas a realidade do dia a dia é outra.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Mensagens fora do horário",
              desc: "Clientes chegam às 22h e só são respondidos no dia seguinte. A maioria não volta.",
            },
            {
              icon: TrendingDown,
              title: "Vendas perdidas todo dia",
              desc: "Quem responde primeiro leva a venda. Depois de uma hora no vácuo, o cliente já está conversando com outra empresa.",
            },
            {
              icon: Frown,
              title: "Equipe sobrecarregada",
              desc: "Sua equipe repete as mesmas respostas o dia inteiro e não sobra tempo para o que realmente importa.",
            },
          ].map((p) => (
            <Card key={p.title} className="border-destructive/20">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <p.icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3">{p.title}</CardTitle>
                <CardDescription>{p.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Solução */}
      <section id="solucao" className="bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              A solução
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Uma IA treinada com o seu negócio, atendendo 24 horas no seu WhatsApp
            </h2>
            <p className="mt-4 text-muted-foreground">
              A Argos responde como você responderia. Conhece seus produtos, seus preços e o tom da
              sua marca. Funciona dentro do WhatsApp Web que você já usa.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
            {[
              {
                icon: Brain,
                title: "Aprende com a sua empresa",
                desc: "Você cadastra perguntas e respostas, envia arquivos com informações do negócio e define o tom de voz. A IA usa tudo isso em cada conversa.",
              },
              {
                icon: MessageSquare,
                title: "Responde como gente",
                desc: "Conversas naturais, no tom da sua marca, sem aquele jeito robotizado de bot com menu de opções.",
              },
              {
                icon: Sparkles,
                title: "Resposta em segundos",
                desc: "Enquanto o concorrente demora horas, a Argos responde na hora — e quem responde primeiro vende.",
              },
              {
                icon: Monitor,
                title: "Zero mudança de hábito",
                desc: "Você continua no WhatsApp Web que já usa, com o mesmo número. A Argos entra por uma extensão no Chrome e, se você responder manualmente, ela entende e sai da frente.",
              },
            ].map((s) => (
              <div key={s.title} className="flex gap-4 rounded-lg border bg-background p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Objeção nº1: "e se a IA responder errado pro meu cliente?" */}
          <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-5">
              <UserCheck className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">E se ela não souber responder?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A IA não inventa. Quando não tem a informação, ela avisa o cliente que vai verificar
                e deixa a conversa marcada para você assumir.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-5">
              <HeartHandshake className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">Você no controle, sempre</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Entrou na conversa? A IA percebe na hora e sai da frente. Você liga e desliga a
                qualquer momento, por contato.
              </p>
            </div>
            <div className="rounded-lg border bg-background p-5">
              <Brain className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">Fica melhor a cada dia</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Quanto mais você ensina (perguntas, preços, arquivos), mais precisa e natural ela
                responde. Você ajusta quando quiser.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Veja em ação — só na /vendas; na home o mockup já está no hero */}
      {variant === "compact" && (
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                Veja em ação
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                22h47, loja fechada — e a venda acontecendo
              </h2>
              <p className="mt-4 text-muted-foreground">
                É assim que uma conversa flui com a Argos: o cliente pergunta, a IA responde na hora
                com as informações que você cadastrou e conduz até o fechamento.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Responde com seus preços, produtos e regras de entrega",
                  "Mantém o tom da sua marca em cada mensagem",
                  "Se você entrar na conversa, a IA percebe e sai da frente",
                ].map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {i}
                  </li>
                ))}
              </ul>
            </div>
            <WhatsAppDemo />
          </div>
        </section>
      )}

      {/* O que muda na prática — faixa de destaque */}
      <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary to-emerald-600/80" />
        <div className="container relative mx-auto px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            O que muda no seu atendimento a partir de hoje
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-8 text-center md:grid-cols-3">
            {[
              { stat: "Segundos", label: "para responder qualquer cliente, a qualquer hora do dia" },
              { stat: "24/7", label: "atendendo de madrugada, no feriado e no fim de semana" },
              { stat: "Zero", label: "mensagens esquecidas no vácuo esperando alguém ver" },
            ].map((r) => (
              <div key={r.label}>
                <div className="text-5xl font-extrabold tracking-tight">{r.stat}</div>
                <p className="mt-2 text-sm text-primary-foreground/85">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prova social — só aparece quando há depoimentos reais cadastrados */}
      {TESTIMONIALS.length > 0 && (
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Quem usa, aprova
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Negócios que pararam de perder cliente no WhatsApp
            </h2>
            {SOCIAL_PROOF_STAT && (
              <p className="mt-3 font-semibold text-primary">{SOCIAL_PROOF_STAT}</p>
            )}
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name}>
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 text-primary">
                    {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-3 text-sm">“{t.quote}”</p>
                  <p className="mt-4 text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Casos de uso */}
      {variant === "full" && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                Para quem é
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Feita para o dia a dia do pequeno negócio
              </h2>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
              {[
                {
                  icon: UtensilsCrossed,
                  title: "Delivery e alimentação",
                  desc: "Os pedidos chegam todos de uma vez na hora do rush — e continuam chegando depois que a cozinha fechou. A IA informa cardápio, preços e condições sem deixar ninguém no vácuo.",
                },
                {
                  icon: CalendarClock,
                  title: "Clínicas, estúdios e serviços",
                  desc: "Dúvidas sobre horários, valores e procedimentos respondidas na hora, mesmo quando a recepção já foi embora. O cliente chega na conversa com tudo esclarecido.",
                },
                {
                  icon: Store,
                  title: "Lojas e revendas",
                  desc: "Tira dúvidas de produto, informa formas de pagamento e entrega, e mantém o cliente aquecido até a sua equipe assumir a venda.",
                },
              ].map((c) => (
                <Card key={c.title}>
                  <CardContent className="pt-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <c.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold">{c.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Como funciona */}
      <section id="como" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Como funciona
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Em poucos minutos sua IA está atendendo
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            {
              n: "1",
              icon: Rocket,
              title: "Crie sua conta",
              desc: "Escolha o plano, preencha seus dados e pague via Pix ou cartão. O acesso libera na hora em que o pagamento confirma.",
            },
            {
              n: "2",
              icon: Brain,
              title: "Ensine sua IA",
              desc: "No painel, cadastre perguntas frequentes, preços e o jeito de falar da sua marca. Dá até para enviar arquivos com informações do negócio.",
            },
            {
              n: "3",
              icon: Zap,
              title: "Conecte o WhatsApp",
              desc: "Cadastre o número do seu WhatsApp no painel, baixe a extensão e instale no Chrome do computador que fica com o WhatsApp Web aberto. Conforme o plano, dá para usar mais de um computador.",
            },
          ].map((step) => (
            <div key={step.n} className="relative rounded-lg border p-6">
              <div className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {step.n}
              </div>
              <step.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-semibold text-foreground">Importante: como a Argos fica online</p>
          <p className="mt-1 text-muted-foreground">
            A Argos funciona acoplada ao seu WhatsApp Web. Para a IA responder seus clientes, é
            necessário ter pelo menos
            <strong className="text-foreground">
              {" "}
              um computador ligado, com o Chrome aberto, a extensão da Argos instalada e o WhatsApp
              Web conectado
            </strong>
            . Se todos os computadores forem desligados ou o WhatsApp Web for fechado, a IA pausa
            até voltar a estar online. Conforme o seu plano, você pode instalar em mais de um
            computador para garantir disponibilidade.
          </p>
        </div>
      </section>

      {/* Risco-zero: garantia + bônus, logo antes do preço */}
      {(GUARANTEE_DAYS > 0 || WELCOME_BONUS) && (
        <section className="container mx-auto px-4 pt-20">
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {GUARANTEE_DAYS > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
                <ShieldCheck className="h-7 w-7 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">Garantia de {GUARANTEE_DAYS} dias</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Testou e não era pra você? Devolvemos o valor dentro de {GUARANTEE_DAYS} dias.
                    Sem burocracia, sem perguntas difíceis.
                  </p>
                </div>
              </div>
            )}
            {WELCOME_BONUS && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
                <Gift className="h-7 w-7 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">Comece com o pé direito</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{WELCOME_BONUS}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Planos */}
      <PricingSection plans={plans} isLoading={isLoading} isError={isError} />

      {/* Garantia / objeções */}
      {variant === "full" && (
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                Sem risco
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Compromisso real, sem letra miúda
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: BadgeCheck,
                  title: "Sem fidelidade",
                  desc: "Plano mensal de verdade. Sem multa, sem contrato de permanência, sem ligação de retenção.",
                },
                {
                  icon: Shield,
                  title: "Seus dados são seus",
                  desc: "A base de conhecimento e as informações do seu negócio pertencem à sua empresa.",
                },
                {
                  icon: Users,
                  title: "Suporte humano",
                  desc: "Time real atende por tickets no painel e ajuda a configurar a IA do jeito do seu negócio. Planos maiores têm prioridade na fila.",
                },
                {
                  icon: Zap,
                  title: "Atualizações contínuas",
                  desc: "Novos modelos de IA e melhorias sem custo extra dentro do seu plano.",
                },
              ].map((g) => (
                <div key={g.title} className="flex gap-3 rounded-lg border p-4">
                  <g.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm">{g.title}</h3>
                    <p className="text-sm text-muted-foreground">{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="container mx-auto px-4 py-20">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-primary p-10 text-center text-primary-foreground md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary via-primary to-emerald-600/80" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Quantos clientes você vai perder esta semana?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
              Cada dia sem resposta rápida é venda indo embora. Ative a Argos em poucos minutos e
              nenhum cliente fica mais no vácuo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="secondary" className="font-semibold" asChild>
                <Link to="/assinar" search={{ plan: undefined }}>
                  Quero começar agora <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                asChild
              >
                <a href="#pricing">Ver planos</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-primary-foreground/75">
              Pix ou cartão · Sem fidelidade · Cancele quando quiser
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
