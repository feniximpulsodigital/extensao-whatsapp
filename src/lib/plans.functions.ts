import { createServerFn } from "@tanstack/react-start";

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  priceCentsAnnual: number;
  monthlyCredits: number;
  maxDevices: number | null;
  maxNumbers: number | null;
  supportPriority: number;
  features: string[];
  sortOrder: number;
  highlight: boolean;
};

// Gera bullets a partir dos limites reais do plano, para a descrição na página
// de vendas ficar sempre compatível com o que o cliente realmente recebe.
// Mescla com as features escritas à mão no admin (sem duplicar).
function buildFeatures(p: {
  monthlyCredits: number;
  maxNumbers: number | null;
  maxDevices: number | null;
  isTopSupport: boolean;
  features: unknown;
}): string[] {
  const auto: string[] = [];

  auto.push(`${p.monthlyCredits.toLocaleString("pt-BR")} créditos de IA por mês`);

  if (p.maxNumbers === 1) auto.push("1 número de WhatsApp");
  else if (p.maxNumbers && p.maxNumbers > 1) auto.push(`Até ${p.maxNumbers} números de WhatsApp`);
  else auto.push("Números de WhatsApp ilimitados");

  if (p.maxDevices === 1) auto.push("1 computador conectado");
  else if (p.maxDevices && p.maxDevices > 1) auto.push(`Até ${p.maxDevices} computadores ao mesmo tempo`);
  else auto.push("Computadores ilimitados");

  auto.push("Transcrição de áudios dos clientes");
  auto.push(p.isTopSupport ? "Suporte prioritário" : "Suporte humano por tickets");

  // features manuais do admin que não repitam o que já foi gerado
  const manual = Array.isArray(p.features) ? (p.features as string[]) : [];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const seen = new Set(auto.map(norm));
  for (const f of manual) {
    if (f && !seen.has(norm(f))) {
      auto.push(f);
      seen.add(norm(f));
    }
  }
  return auto;
}

// Público — lê os planos ativos diretamente do banco para a landing/vendas.
export const getPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select(
      "id, name, description, price_cents, price_cents_annual, monthly_credits, max_devices, max_numbers, support_priority, features, sort_order",
    )
    .eq("is_active", true)
    .eq("is_custom", false)
    .order("sort_order", { ascending: true })
    .order("price_cents", { ascending: true });
  if (error) return { plans: [] as PublicPlan[] };

  const rows = data ?? [];
  const maxPriority = Math.max(1, ...rows.map((p) => p.support_priority ?? 1));

  const plans: PublicPlan[] = rows.map((p, i, arr) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.price_cents,
    priceCentsAnnual: p.price_cents_annual ?? 0,
    monthlyCredits: p.monthly_credits,
    maxDevices: p.max_devices,
    maxNumbers: p.max_numbers,
    supportPriority: p.support_priority ?? 1,
    features: buildFeatures({
      monthlyCredits: p.monthly_credits,
      maxNumbers: p.max_numbers,
      maxDevices: p.max_devices,
      isTopSupport: (p.support_priority ?? 1) >= maxPriority && maxPriority > 1,
      features: p.features,
    }),
    sortOrder: p.sort_order,
    // destaca o segundo (geralmente o "Pro"), ou o último se só houver um
    highlight: arr.length > 1 ? i === 1 : false,
  }));
  return { plans };
});
