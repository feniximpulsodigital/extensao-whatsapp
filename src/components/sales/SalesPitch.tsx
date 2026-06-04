import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare, Clock, TrendingDown, Frown, Check, ArrowRight,
  Sparkles, Brain, Shield, Zap, Users, Star, BadgeCheck, Rocket,
} from "lucide-react";

export function SalesPitch({ variant = "full" }: { variant?: "full" | "compact" }) {
  return (
    <>
      {/* Dor / problema */}
      <section id="problemas" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">O problema</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Cada mensagem sem resposta é um cliente que vai para o concorrente
          </h2>
          <p className="mt-4 text-muted-foreground">
            Você sabe que precisa responder rápido. Mas a realidade do dia a dia é outra.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            { icon: Clock, title: "Mensagens fora do horário", desc: "Clientes chegam às 22h e só são respondidos no dia seguinte. A maioria não volta." },
            { icon: TrendingDown, title: "Vendas perdidas todo dia", desc: "Cada minuto sem resposta reduz em até 80% a chance de fechamento, segundo a Harvard Business Review." },
            { icon: Frown, title: "Equipe sobrecarregada", desc: "Sua equipe repete as mesmas respostas o dia inteiro e não sobra tempo para o que realmente importa." },
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
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">A solução</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Uma IA treinada com o seu negócio, atendendo 24 horas no seu WhatsApp
            </h2>
            <p className="mt-4 text-muted-foreground">
              A Argos responde como você responderia. Conhece seus produtos, seus preços e o tom da sua marca.
              Funciona dentro do WhatsApp Web que você já usa.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
            {[
              { icon: Brain, title: "Aprende com a sua empresa", desc: "Você cadastra perguntas, respostas e o tom de voz. A IA usa isso em cada conversa." },
              { icon: MessageSquare, title: "Responde como gente", desc: "Conversas naturais, sem aquele jeito robotizado. Seu cliente nem percebe que é IA." },
              { icon: Sparkles, title: "Resposta em segundos", desc: "Enquanto seu concorrente demora 4 horas, a Argos responde em 4 segundos. Você ganha a venda." },
              { icon: Shield, title: "Você no controle", desc: "Liga e desliga quando quiser. Edita as respostas. Você decide quando a IA assume." },
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

      {/* Resultados / números */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">Resultados</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Negócios que respondem rápido vendem mais
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
          {[
            { stat: "+ 3x", label: "mais conversas atendidas no mesmo dia" },
            { stat: "80%", label: "menos tempo da equipe em mensagens repetidas" },
            { stat: "24/7", label: "disponibilidade real, sem feriado ou madrugada" },
          ].map((r) => (
            <Card key={r.label}>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-primary">{r.stat}</div>
                <p className="mt-2 text-sm text-muted-foreground">{r.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Depoimentos */}
      {variant === "full" && (
        <section className="bg-muted/40 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">Quem usa, recomenda</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Empresas que pararam de perder cliente no WhatsApp
              </h2>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
              {[
                { name: "Marina S.", role: "Padaria Vó Lina", quote: "Em uma semana a Argos respondeu mais de 400 pedidos sozinha. Minha esposa parou de atender no celular durante o jantar." },
                { name: "Rafael T.", role: "Studio Pilates RT", quote: "Antes eu perdia agendamentos porque demorava para responder. Agora a IA agenda na hora, mesmo de madrugada." },
                { name: "Camila A.", role: "Loja Bella Moda", quote: "Vendi pelo WhatsApp em horário que minha loja já estava fechada. Pagou a mensalidade no primeiro fim de semana." },
              ].map((t) => (
                <Card key={t.name}>
                  <CardContent className="pt-6">
                    <div className="flex gap-1 text-primary">
                      {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                    </div>
                    <p className="mt-4 text-sm">"{t.quote}"</p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
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
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">Como funciona</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Em 5 minutos sua IA está atendendo
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            { n: "1", icon: Rocket, title: "Crie sua conta", desc: "Cadastro grátis em segundos. Sem cartão de crédito para começar." },
            { n: "2", icon: Brain, title: "Ensine sua IA", desc: "Cole perguntas frequentes, preços e o jeito de falar da sua marca." },
            { n: "3", icon: Zap, title: "Conecte o WhatsApp", desc: "Instale a extensão Chrome, escaneie o QR e pronto: ela já responde." },
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
      </section>

      {/* Planos */}
      <section id="pricing" className="bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">Planos</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Cabe no bolso. Paga sozinho na primeira venda extra.
            </h2>
            <p className="mt-4 text-muted-foreground">Comece grátis. Sem fidelidade. Cancele quando quiser.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            {[
              {
                name: "Starter",
                price: "R$ 97",
                tagline: "Pra começar a responder rápido hoje.",
                features: ["1.000 créditos/mês", "1 número de WhatsApp", "Base de conhecimento ilimitada", "Suporte por e-mail"],
              },
              {
                name: "Pro",
                price: "R$ 297",
                tagline: "Pra quem vende todo dia pelo WhatsApp.",
                features: ["5.000 créditos/mês", "Até 3 números", "Prompts customizados", "Resposta automática 24/7", "Suporte prioritário"],
                highlight: true,
              },
            ].map((p) => (
              <Card key={p.name} className={p.highlight ? "border-primary shadow-lg relative" : ""}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Mais escolhido
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>{p.tagline}</CardDescription>
                  <div className="mt-2 text-3xl font-bold">
                    {p.price}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" /> {feat}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-6 w-full" variant={p.highlight ? "default" : "outline"} asChild>
                    <Link to="/login">Começar agora <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Garantia / objeções */}
      {variant === "full" && (
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">Sem risco</span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Você testa antes de pagar
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {[
                { icon: BadgeCheck, title: "7 dias para experimentar", desc: "Use sem cartão. Se não gostar, simplesmente não assina." },
                { icon: Shield, title: "Seus dados são seus", desc: "Conversas criptografadas. Você é dono da sua base de conhecimento." },
                { icon: Users, title: "Suporte humano", desc: "Time real ajuda você a configurar a IA do jeito do seu negócio." },
                { icon: Zap, title: "Sem fidelidade", desc: "Cancela em um clique. Nada de multa, nada de letra miúda." },
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
            Cada dia sem a Argos é dinheiro saindo pela porta. Comece grátis agora, leva 5 minutos.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/login">Quero começar grátis <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/vendas">Ver página de vendas</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito. Sem fidelidade.</p>
        </div>
      </section>
    </>
  );
}
