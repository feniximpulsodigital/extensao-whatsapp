import type { ReactNode } from "react";
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
import { getPublicPlans } from "@/lib/plans.functions";
import { WhatsAppDemo } from "@/components/sales/WhatsAppDemo";

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
        </div>
      </section>

      {/* Veja em ação */}
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

      {/* O que muda na prática */}
      <section className="bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Na prática
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              O que muda no seu atendimento
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {[
              {
                stat: "Segundos",
                label: "para responder qualquer cliente, a qualquer hora do dia",
              },
              { stat: "24/7", label: "atendendo de madrugada, no feriado e no fim de semana" },
              { stat: "Zero", label: "mensagens esquecidas no vácuo esperando alguém ver" },
            ].map((r) => (
              <Card key={r.label}>
                <CardContent className="pt-6 text-center">
                  <div className="text-4xl font-bold text-primary">{r.stat}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

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

      {/* Planos */}
      <section id="pricing" className="bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Planos
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Cabe no bolso. Paga sozinho na primeira venda extra.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Pix ou cartão · Sem fidelidade · Cancele quando quiser
            </p>
          </div>
          {isLoading ? (
            <p className="mt-12 text-center text-sm text-muted-foreground">Carregando planos…</p>
          ) : isError || plans.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os planos agora. Crie sua conta e escolha o plano na etapa
                de pagamento.
              </p>
              <CtaButton className="mt-6">
                Criar minha conta <ArrowRight className="h-4 w-4" />
              </CtaButton>
            </div>
          ) : (
            <div
              className={`mx-auto mt-12 grid max-w-5xl gap-6 ${plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              {plans.map((p) => (
                <Card key={p.id} className={p.highlight ? "border-primary shadow-lg relative" : ""}>
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Mais escolhido
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    {p.description && <CardDescription>{p.description}</CardDescription>}
                    <div className="mt-2 text-3xl font-bold">
                      {formatBRL(p.priceCents)}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.monthlyCredits.toLocaleString("pt-BR")} créditos de IA por mês
                    </p>
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
              ))}
            </div>
          )}
        </div>
      </section>

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
        <div className="mx-auto max-w-3xl rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Quantos clientes você vai perder esta semana?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Cada dia sem resposta rápida é venda indo embora. A ativação leva poucos minutos.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaButton>
              Quero começar agora <ArrowRight className="h-4 w-4" />
            </CtaButton>
            <Button size="lg" variant="outline" asChild>
              <a href="#pricing">Ver planos</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Pix ou cartão · Sem fidelidade · Cancele quando quiser
          </p>
        </div>
      </section>
    </>
  );
}
