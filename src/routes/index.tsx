import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, MessageSquare, Shield, Zap, Check, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Argos — Respostas automáticas com IA no WhatsApp Web" },
      {
        name: "description",
        content:
          "Argos é a extensão Chrome que responde seus clientes no WhatsApp Web com IA. Atendimento 24/7, treinada com sua base de conhecimento.",
      },
      { property: "og:title", content: "Argos — IA para WhatsApp Web" },
      {
        property: "og:description",
        content: "Automatize o atendimento no WhatsApp com IA personalizada para sua empresa.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">Argos</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Recursos
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Planos
            </a>
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">
              Como funciona
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/login">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs">
          <Zap className="h-3 w-3" /> Extensão Chrome + IA dedicada
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Respostas automáticas no WhatsApp Web com IA
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Atenda seus clientes 24/7 com uma IA treinada na sua base de conhecimento. Instale a
          extensão, conecte sua conta e deixe a Argos cuidar do resto.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/login">
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#pricing">Ver planos</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Tudo que sua empresa precisa</h2>
          <p className="mt-3 text-muted-foreground">
            Uma plataforma completa de IA para atendimento via WhatsApp.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: MessageSquare,
              title: "Respostas inteligentes",
              desc: "IA treinada com a base de conhecimento da sua empresa.",
            },
            {
              icon: Shield,
              title: "Extensão segura",
              desc: "Cada cliente recebe um pacote personalizado com sua chave única.",
            },
            {
              icon: Zap,
              title: "Sistema de créditos",
              desc: "Pague apenas pelo que usar. Pacotes flexíveis e planos mensais.",
            },
          ].map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3">{f.title}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Planos para cada tamanho</h2>
          <p className="mt-3 text-muted-foreground">Comece grátis. Escale quando precisar.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          {[
            {
              name: "Starter",
              price: "R$ 97",
              features: ["1.000 créditos/mês", "1 número de WhatsApp", "Base de conhecimento"],
            },
            {
              name: "Pro",
              price: "R$ 297",
              features: [
                "5.000 créditos/mês",
                "Até 3 números",
                "Prompts customizados",
                "Suporte prioritário",
              ],
              highlight: true,
            },
          ].map((p) => (
            <Card key={p.name} className={p.highlight ? "border-primary shadow-lg" : ""}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <div className="mt-2 text-3xl font-bold">
                  {p.price}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" /> {feat}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={p.highlight ? "default" : "outline"} asChild>
                  <Link to="/login">Começar agora</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Argos</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Argos. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
