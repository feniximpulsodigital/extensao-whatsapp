import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SalesPitch, CtaButton } from "@/components/sales/SalesPitch";
import { SiteFooter } from "@/components/sales/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Argos — Pare de perder clientes no WhatsApp. IA atende por você 24/7" },
      {
        name: "description",
        content:
          "A Argos responde seus clientes no WhatsApp Web em segundos, com IA treinada no seu negócio. Atendimento 24 horas, vendas que não dormem.",
      },
      { property: "og:title", content: "Argos — IA que vende no seu WhatsApp 24/7" },
      {
        property: "og:description",
        content:
          "Cada minuto sem resposta é uma venda perdida. Deixe a IA atender enquanto você foca no que importa.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo size={36} className="text-lg" />
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#problemas" className="text-sm text-muted-foreground hover:text-foreground">
              Problema
            </a>
            <a href="#solucao" className="text-sm text-muted-foreground hover:text-foreground">
              Solução
            </a>
            <a href="#como" className="text-sm text-muted-foreground hover:text-foreground">
              Como funciona
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Planos
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <CtaButton size="sm">Começar agora</CtaButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-24 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs">
            <Zap className="h-3 w-3 text-primary" /> A IA que responde antes do seu concorrente
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Pare de perder cliente no WhatsApp.{" "}
            <span className="text-primary">A Argos responde por você, 24/7.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Enquanto você dorme, almoça ou atende outro cliente, a Argos conversa, tira dúvidas,
            informa preços e mantém o cliente aquecido — direto no seu WhatsApp Web, com a cara da
            sua empresa.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaButton>
              Quero começar agora <ArrowRight className="h-4 w-4" />
            </CtaButton>
            <Button size="lg" variant="outline" asChild>
              <a href="#pricing">
                <MessageCircle className="h-4 w-4 mr-1" />
                Ver planos e benefícios
              </a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Pix ou cartão · Sem fidelidade · Funciona enquanto houver 1 PC com o WhatsApp Web aberto
            e a extensão ativa
          </p>
        </div>
      </section>

      <SalesPitch variant="full" />

      <SiteFooter />
    </div>
  );
}
