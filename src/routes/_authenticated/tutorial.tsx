import { createFileRoute } from "@tanstack/react-router";
import { Book, ChevronDown } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/tutorial")({
  component: TutorialPage,
});

function TutorialPage() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const sections = [
    {
      id: "criacao",
      title: "1️⃣ Criação da Conta",
      content: "Você já criou sua conta! Agora é hora de treinar a IA com informações do seu negócio.",
    },
    {
      id: "plano",
      title: "2️⃣ Seu Plano Atual",
      content:
        "Verifique seu plano no Dashboard. Você pode trocar de plano a qualquer momento — se subir, cobra a diferença na hora; se descer, vale no próximo mês.",
    },
    {
      id: "configuracao",
      title: "3️⃣ Configurar a IA",
      steps: [
        "Clique em 'Configurar IA' no menu lateral",
        "Preencha o tom de voz (como você quer que a IA fale)",
        "Adicione informações da empresa (descrição, produtos, preços)",
        "Inclua exemplos de perguntas e respostas que você recebe",
        "Clique em 'Salvar configurações'",
      ],
      tip: "💡 Quanto mais detalhes você der, melhor a IA aprende!",
    },
    {
      id: "extensao",
      title: "4️⃣ Instalar a Extensão",
      steps: [
        "Clique em 'Baixar Extensão' no Dashboard",
        "Clique em 'Gerar e baixar extensão'",
        "Um arquivo .zip será baixado — extraia em uma pasta",
        "Abra Chrome e vá para chrome://extensions/",
        "Ative 'Modo de desenvolvedor' (canto superior direito)",
        "Clique em 'Carregar extensão sem empacotamento'",
        "Selecione a pasta da extensão",
      ],
      tip: "✅ Você verá 'Argos Responde' entre as extensões do Chrome",
    },
    {
      id: "whatsapp",
      title: "5️⃣ Acessar WhatsApp Web",
      steps: [
        "Abra https://web.whatsapp.com/ no Chrome",
        "Escaneie o QR code com seu celular",
        "Aguarde o WhatsApp carregar completamente",
        "Abra uma conversa qualquer — deve ver 'IA ativa' no topo",
      ],
      tip: "🎯 A extensão só funciona com WhatsApp Web aberto",
    },
    {
      id: "uso",
      title: "6️⃣ Ativar e Usar",
      steps: [
        "Abra uma conversa no WhatsApp Web",
        "No topo, clique no botão 'Ativar IA'",
        "O ícone ficará verde — pronto!",
        "A IA passará a responder mensagens neste contato",
        "Quando quiser responder você mesmo, é só digitar — a IA detecta e se afasta",
      ],
      tip: "⚡ Respostas saem em menos de 3 segundos",
    },
    {
      id: "creditos",
      title: "7️⃣ Gerenciar Créditos",
      content:
        "No Dashboard, você vê quantos créditos tem disponíveis. Cada resposta gasta créditos. Quando acabarem, você pode comprar mais com um clique.",
      tip: "💳 Se ativou PIX, a assinatura é renovada mensalmente automaticamente",
    },
    {
      id: "suporte",
      title: "8️⃣ Precisa de Ajuda?",
      steps: [
        "Clique em 'Suporte' no menu do Dashboard",
        "Clique em 'Abrir novo ticket'",
        "Descreva seu problema com detalhes",
        "Nossa equipe responderá via e-mail em poucas horas",
      ],
      tip: "📞 Ou envie e-mail direto para support@argosresponde.com.br",
    },
  ];

  const faqs = [
    {
      q: "⏱️ Quanto tempo leva para a IA responder?",
      a: "Menos de 3 segundos normalmente. Se enviar áudio, até 5 segundos (transcrição).",
    },
    {
      q: "💻 A IA responde quando desligo o computador?",
      a: "Não. A IA roda apenas enquanto o Chrome está aberto com o WhatsApp Web.",
    },
    {
      q: "🔄 Posso trocar de plano depois?",
      a: "Sim! Vá ao Dashboard → Planos. Se subir, cobra a diferença. Se descer, vale no próximo mês.",
    },
    {
      q: "🛑 O que acontece se os créditos acabarem?",
      a: "A IA para de responder. Você pode comprar créditos extras a qualquer momento no Dashboard.",
    },
    {
      q: "✅ Tenho garantia?",
      a: "Sim! 7 dias. Se não gostar, clique em 'Solicitar reembolso' no Dashboard — sem burocracia.",
    },
    {
      q: "📱 Posso usar em mais de um número?",
      a: "Depende do plano. Starter: 1 número. Outros planos: contato com suporte.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Book className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">Tutorial: Como Usar a Argos</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Passo a passo para configurar e começar a usar o sistema. Leia com atenção e siga cada etapa!
          </p>
        </div>

        {/* Quick Start Box */}
        <div className="bg-primary/10 border-l-4 border-primary rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-primary mb-3">🚀 Começar Agora</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Configure a IA com as informações da sua empresa</li>
            <li>Baixe e instale a extensão no Chrome</li>
            <li>Abra o WhatsApp Web</li>
            <li>Ative a IA em um contato de teste</li>
            <li>Teste com uma mensagem — pronto!</li>
          </ol>
        </div>

        {/* Tutorial Sections */}
        <div className="space-y-4 mb-12">
          {sections.map((section) => (
            <div
              key={section.id}
              className="border border-border rounded-lg overflow-hidden bg-card"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
              >
                <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                <ChevronDown
                  className={`h-5 w-5 text-primary transition-transform ${
                    expandedSections[section.id] ? "rotate-180" : ""
                  }`}
                />
              </button>

              {expandedSections[section.id] && (
                <div className="px-6 py-4 border-t border-border bg-muted/30">
                  {section.content && (
                    <p className="text-muted-foreground mb-4">{section.content}</p>
                  )}

                  {section.steps && (
                    <ol className="list-decimal list-inside space-y-2 mb-4">
                      {section.steps.map((step, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          {step}
                        </li>
                      ))}
                    </ol>
                  )}

                  {section.tip && (
                    <div className="bg-primary/5 border-l-2 border-primary px-3 py-2 rounded text-sm text-muted-foreground">
                      {section.tip}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-primary mb-6">❓ Perguntas Frequentes</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-border rounded-lg overflow-hidden bg-card">
                <button
                  onClick={() => toggleSection(`faq-${i}`)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
                >
                  <span className="font-medium text-foreground text-left">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-primary shrink-0 ml-4 transition-transform ${
                      expandedSections[`faq-${i}`] ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expandedSections[`faq-${i}`] && (
                  <div className="px-6 py-4 border-t border-border bg-muted/30">
                    <p className="text-muted-foreground text-sm">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        <div className="bg-primary/5 border-l-4 border-primary rounded-lg p-6 mb-12">
          <h3 className="text-lg font-bold text-primary mb-4">💡 Dicas Importantes</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">
                Quanto mais detalhes você der na configuração, melhor a IA aprende
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">
                Comece ativando a IA em apenas 2-3 contatos para testar
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">
                Se você responder uma mensagem, a IA detecta e se afasta automaticamente
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span>
              <span className="text-muted-foreground">
                Monitore seus créditos regularmente — quando baixarem, compre mais
              </span>
            </li>
          </ul>
        </div>

        {/* Support CTA */}
        <div className="bg-card border border-primary rounded-lg p-6 text-center">
          <h3 className="text-lg font-bold text-primary mb-2">📞 Ficou com dúvida?</h3>
          <p className="text-muted-foreground mb-4">
            Abra um ticket de suporte no Dashboard ou envie um e-mail para support@argosresponde.com.br
          </p>
          <p className="text-xs text-muted-foreground">
            Nossa equipe responde rapidinho! 🚀
          </p>
        </div>
      </div>
    </div>
  );
}
