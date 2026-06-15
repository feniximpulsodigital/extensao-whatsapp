import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/sales/SiteFooter";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Argos" },
      { name: "description", content: "Política de Privacidade da plataforma Argos (LGPD)." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: junho de 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
          <section>
            <h2>1. Quem somos</h2>
            <p className="mt-2">
              A Argos é uma plataforma de atendimento com inteligência artificial para WhatsApp Web.
              Esta política descreve como tratamos dados pessoais, em conformidade com a Lei Geral
              de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </section>

          <section>
            <h2>2. Dados que coletamos</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Dados de cadastro:</strong> nome, e-mail,
                telefone e nome da empresa, fornecidos por você ao criar a conta.
              </li>
              <li>
                <strong className="text-foreground">Dados de pagamento:</strong> processados pela
                Asaas Gestão Financeira S.A. Não armazenamos números de cartão; guardamos apenas o
                status das cobranças.
              </li>
              <li>
                <strong className="text-foreground">Conteúdo cadastrado:</strong> base de
                conhecimento, arquivos e configurações que você cadastra para treinar a IA.
              </li>
              <li>
                <strong className="text-foreground">Mensagens processadas:</strong> o texto das
                conversas em que a IA atua é processado para gerar as respostas. Esse conteúdo pode
                incluir dados pessoais dos seus clientes — nesse caso, você atua como controlador
                desses dados e a Argos como operadora.
              </li>
              <li>
                <strong className="text-foreground">Dados de uso:</strong> consumo de créditos,
                registros técnicos e métricas necessárias ao funcionamento e à cobrança.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Para que usamos</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>prestar o serviço contratado (gerar respostas de IA no seu WhatsApp);</li>
              <li>emitir cobranças e gerenciar a assinatura;</li>
              <li>prestar suporte e comunicar mudanças relevantes do serviço;</li>
              <li>melhorar a plataforma e prevenir fraudes e abusos.</li>
            </ul>
            <p className="mt-2">
              Não vendemos dados pessoais e não usamos o conteúdo das suas conversas para
              publicidade.
            </p>
          </section>

          <section>
            <h2>4. Com quem compartilhamos</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Asaas</strong> — processamento de pagamentos;
              </li>
              <li>
                <strong className="text-foreground">
                  Provedores de infraestrutura e de modelos de IA
                </strong>{" "}
                — hospedagem dos dados e geração das respostas, sob contratos que limitam o uso ao
                necessário para a prestação do serviço;
              </li>
              <li>autoridades, quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2>5. Retenção e exclusão</h2>
            <p className="mt-2">
              Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário ao
              cumprimento de obrigações legais (por exemplo, registros fiscais de pagamento). Ao
              encerrar a conta, você pode solicitar a exclusão dos dados de cadastro e do conteúdo
              cadastrado, ressalvadas as retenções exigidas por lei.
            </p>
          </section>

          <section>
            <h2>6. Segurança</h2>
            <p className="mt-2">
              Adotamos medidas técnicas e organizacionais para proteger os dados, incluindo
              criptografia em trânsito, controle de acesso por conta e isolamento dos dados de cada
              cliente. Nenhum sistema é 100% seguro; em caso de incidente relevante, comunicaremos
              os afetados conforme a LGPD.
            </p>
          </section>

          <section>
            <h2>7. Seus direitos (LGPD)</h2>
            <p className="mt-2">
              Você pode solicitar a qualquer momento: confirmação do tratamento, acesso, correção,
              anonimização, portabilidade, exclusão de dados e revogação de consentimento. Para
              exercer esses direitos, use os canais de suporte indicados no painel.
            </p>
          </section>

          <section>
            <h2>8. Cookies e tecnologias similares</h2>
            <p className="mt-2">
              Usamos armazenamento local e cookies estritamente necessários para autenticação e
              funcionamento da plataforma. Não utilizamos cookies de publicidade de terceiros.
            </p>
          </section>

          <section>
            <h2>9. Alterações desta política</h2>
            <p className="mt-2">
              Esta política pode ser atualizada periodicamente. Mudanças relevantes serão
              comunicadas pelo painel ou por e-mail. Consulte também os{" "}
              <Link to="/termos" className="underline hover:text-foreground">
                Termos de Uso
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
