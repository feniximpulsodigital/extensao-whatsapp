import { createServerFn } from "@tanstack/react-start";

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  monthlyCredits: number;
  features: string[];
  sortOrder: number;
  highlight: boolean;
};

// Público — lê os planos ativos diretamente do banco para a landing/vendas.
export const getPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("id, name, description, price_cents, monthly_credits, features, sort_order")
    .eq("is_active", true)
    .eq("is_custom", false)
    .order("sort_order", { ascending: true })
    .order("price_cents", { ascending: true });
  if (error) return { plans: [] as PublicPlan[] };

  const plans: PublicPlan[] = (data ?? []).map((p, i, arr) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.price_cents,
    monthlyCredits: p.monthly_credits,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
    sortOrder: p.sort_order,
    // destaca o segundo (geralmente o "Pro"), ou o último se só houver um
    highlight: arr.length > 1 ? i === 1 : false,
  }));
  return { plans };
});
