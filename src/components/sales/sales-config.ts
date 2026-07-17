// ============================================================
// Configuração de marketing da landing/vendas — edite aqui.
// Nada neste arquivo inventa prova social: enquanto estiver vazio,
// as seções correspondentes simplesmente não aparecem.
// ============================================================

// WhatsApp comercial para o botão flutuante "Falar no WhatsApp".
// Formato internacional, só dígitos (ex.: "5511999999999").
export const SALES_WHATSAPP: string | null = "5548992045185";
export const SALES_WHATSAPP_MESSAGE =
  "Olá! Vi o site da Argos e quero saber como funciona para o meu negócio.";

// Depoimentos REAIS de clientes. Comece vazio e preencha conforme coletar.
// A seção de prova social só aparece quando houver pelo menos um item.
export type Testimonial = {
  name: string; // nome do cliente
  role: string; // empresa / segmento
  quote: string; // depoimento
  rating?: number; // 1..5 (opcional)
};
export const TESTIMONIALS: Testimonial[] = [
  // {
  //   name: "Marina S.",
  //   role: "Padaria Vó Lina",
  //   quote: "Em uma semana a Argos respondeu mais de 400 mensagens sozinha...",
  //   rating: 5,
  // },
];

// Métrica de credibilidade exibida na prova social (opcional, honesta).
// Ex.: "+50 empresas atendendo no WhatsApp com a Argos". null = esconde.
// Só preencha com número VERDADEIRO.
export const SOCIAL_PROOF_STAT: string | null = null;

// Selos de confiança baseados em FATOS do produto (não em clientes).
// Aparecem quando ainda não há depoimentos reais, para a seção não ficar
// vazia — sem inventar prova social de pessoas.
export const TRUST_BADGES: string[] = [
  "IA treinada no seu próprio negócio",
  "Responde em segundos, 24 horas por dia",
  "Funciona no seu WhatsApp atual, sem trocar de número",
  "Você assume a conversa quando quiser",
  "Sem fidelidade — cancele a qualquer momento",
];

// Garantia de reembolso (dias). 0 = esconde a faixa de garantia.
export const GUARANTEE_DAYS = 7;

// Bônus de boas-vindas exibido como gatilho de ação. null = esconde.
// Mantenha coerente com o que o sistema realmente concede.
export const WELCOME_BONUS: string | null = null;
