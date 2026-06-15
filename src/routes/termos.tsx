import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/sales/SiteFooter";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Argos" },
      { name: "description", content: "Termos de Uso da plataforma Argos." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link to="/" className="flex items-center">
            <Logo size={32} />
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: junho de 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
          <section>
            <h2>1. O serviço</h2>
            <p className="mt-2">
              A Argos é uma plataforma de atendimento com inteligência artificial que funciona
              acoplada ao WhatsApp Web por meio de uma extensão para o navegador Google Chrome. A IA
              responde mensagens recebidas na conta de WhatsApp do cliente, com base nas informações
              cadastradas pelo próprio cliente no painel (base de conhecimento, tom de voz e
              configurações).
            </p>
          </section>

          <section>
            <h2>2. Cadastro e conta</h2>
            <p className="mt-2">
              Para usar a Argos, você cria uma conta informando nome, empresa, e-mail e telefone, e
              define uma senha. Você é responsável por manter a confidencialidade das suas
              credenciais e por toda atividade realizada na sua conta. As informações fornecidas
              devem ser verdadeiras e atualizadas.
            </p>
          </section>

          <section>
            <h2>3. Planos, pagamento e créditos</h2>
            <p className="mt-2">
              O acesso é liberado mediante assinatura de um dos planos exibidos no site, com
              pagamento mensal via Pix ou cartão de crédito recorrente, processado pela Asaas Gestão
              Financeira S.A. Cada plano inclui uma quantidade mensal de créditos de IA, consumidos
              conforme o uso. Créditos adicionais podem ser adquiridos separadamente. Os valores
              vigentes são os exibidos no site ou no painel no momento da contratação.
            </p>
            <p className="mt-2">
              Não há fidelidade nem multa por cancelamento. Em caso de não pagamento da renovação, o
              acesso à IA é suspenso até a regularização.
            </p>
          </section>

          <section>
            <h2>4. Requisitos técnicos e disponibilidade</h2>
            <p className="mt-2">
              A Argos depende de pelo menos um computador ligado, com o navegador Chrome aberto, a
              extensão da Argos instalada e o WhatsApp Web conectado. Se nenhum computador estiver
              nessas condições, a IA fica pausada até a conexão voltar. A Argos não se
              responsabiliza por indisponibilidade causada por falta desses requisitos, por
              instabilidade do WhatsApp Web ou por mudanças realizadas pelo WhatsApp/Meta em sua
              plataforma.
            </p>
          </section>

          <section>
            <h2>5. Uso aceitável</h2>
            <p className="mt-2">É proibido usar a Argos para:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                envio de spam, mensagens em massa não solicitadas ou qualquer prática vedada pelos
                termos do WhatsApp;
              </li>
              <li>
                atividades ilícitas, fraudulentas, enganosas ou que violem direitos de terceiros;
              </li>
              <li>
                conteúdo discriminatório, difamatório ou que infrinja a legislação brasileira.
              </li>
            </ul>
            <p className="mt-2">
              O descumprimento pode resultar em suspensão ou encerramento da conta, sem prejuízo das
              medidas legais cabíveis.
            </p>
          </section>

          <section>
            <h2>6. Conteúdo gerado pela IA</h2>
            <p className="mt-2">
              As respostas são geradas automaticamente com base nas informações cadastradas pelo
              cliente. Apesar do empenho em qualidade, respostas de IA podem conter imprecisões. O
              cliente é responsável por revisar as informações cadastradas e por acompanhar os
              atendimentos, podendo assumir qualquer conversa a qualquer momento.
            </p>
          </section>

          <section>
            <h2>7. Propriedade e dados do cliente</h2>
            <p className="mt-2">
              A base de conhecimento, os arquivos enviados e as configurações cadastradas pertencem
              ao cliente. A plataforma, a marca Argos, o software e a extensão pertencem à Argos. O
              tratamento de dados pessoais está descrito na{" "}
              <Link to="/privacidade" className="underline hover:text-foreground">
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          <section>
            <h2>8. Relação com o WhatsApp</h2>
            <p className="mt-2">
              A Argos é um produto independente e não é afiliada, associada, endossada ou
              patrocinada pelo WhatsApp LLC ou pela Meta Platforms, Inc. O uso do WhatsApp pelo
              cliente permanece regido pelos termos do próprio WhatsApp, sendo de responsabilidade
              do cliente utilizá-lo em conformidade com eles.
            </p>
          </section>

          <section>
            <h2>9. Limitação de responsabilidade</h2>
            <p className="mt-2">
              O serviço é fornecido "como está". Na máxima extensão permitida pela lei, a Argos não
              responde por lucros cessantes, perda de vendas ou danos indiretos decorrentes do uso
              ou da indisponibilidade do serviço. Nada nestes termos exclui responsabilidades que
              não possam ser excluídas pela legislação aplicável, incluindo o Código de Defesa do
              Consumidor.
            </p>
          </section>

          <section>
            <h2>10. Cancelamento</h2>
            <p className="mt-2">
              Você pode cancelar a assinatura a qualquer momento, sem multa. O acesso permanece
              ativo até o fim do período já pago. Créditos não utilizados não são reembolsáveis após
              o encerramento do período.
            </p>
          </section>

          <section>
            <h2>11. Alterações</h2>
            <p className="mt-2">
              Estes termos podem ser atualizados periodicamente. Mudanças relevantes serão
              comunicadas pelo painel ou por e-mail. O uso continuado do serviço após a atualização
              representa concordância com a nova versão.
            </p>
          </section>

          <section>
            <h2>12. Contato e foro</h2>
            <p className="mt-2">
              Dúvidas sobre estes termos podem ser enviadas pelos canais de suporte indicados no
              painel. Aplica-se a legislação brasileira.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
