import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, Clock, Star } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SalesPitch, CtaButton } from "@/components/sales/SalesPitch";
import { WhatsAppDemo } from "@/components/sales/WhatsAppDemo";
import { WhatsAppFloat } from "@/components/sales/WhatsAppFloat";
import { SiteFooter } from "@/components/sales/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Argos — Pare de perder clientes no WhatsApp. IA atende por você 24 horas" },
      {
        name: "description",
        content:
          "A Argos responde seus clientes no WhatsApp Web em segundos, com IA treinada no seu negócio. Atendimento 24 horas, vendas que não dormem.",
      },
      { property: "og:title", content: "Argos — IA que vende no seu WhatsApp 24 horas" },
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
      <section className="relative overflow-hidden border-b border-border">
        {/* glow de fundo */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

        <div className="container mx-auto grid items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
          {/* coluna texto */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Zap className="h-3 w-3" /> Responde em segundos — antes do seu concorrente
            </div>
            <p className="mt-5 text-sm font-medium text-primary">
              Uma extensão que coloca IA no seu WhatsApp Web — sem trocar de número, sem app novo.
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl xl:text-6xl">
              Seu WhatsApp vendendo{" "}
              <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                24 horas por dia
              </span>
              , mesmo quando você não está.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
              A Argos é uma IA treinada no seu negócio que atende, tira dúvidas e conduz a conversa no
              seu próprio WhatsApp Web — com a cara da sua empresa. O cliente é respondido na hora.
              Você não perde mais nenhuma venda no vácuo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <CtaButton>
                Quero vender 24h <ArrowRight className="h-4 w-4" />
              </CtaButton>
              <Button size="lg" variant="outline" asChild>
                <a href="#como">Ver como funciona</a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground lg:justify-start">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" /> Pronto em minutos
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-primary" /> Sem fidelidade
              </span>
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-primary" /> Usa o seu número atual
              </span>
            </div>
          </div>

          {/* coluna visual: a prova do produto */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
            <WhatsAppDemo />
          </div>
        </div>
      </section>

      <SalesPitch variant="full" />

      <SiteFooter />
      <WhatsAppFloat />
    </div>
  );
}
