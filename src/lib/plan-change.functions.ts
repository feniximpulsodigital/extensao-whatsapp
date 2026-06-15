import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Troca de plano pelo cliente:
// - Upgrade (plano mais caro): cobra agora via checkout (reusa createPixCharge/
//   createCardSubscription, que gravam payments.plan_id; o webhook aplica o
//   plano e credita a cota ao confirmar).
// - Downgrade (plano mais barato): agenda em tenants.pending_plan_id; o cron de
//   renovação aplica na virada do ciclo. Não cobra nem credita agora.

async function loadTenant(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tenants")
    .select("id, status, plan_id, pending_plan_id, billing_cycle, subscription_renews_at")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Conta sem empresa vinculada");
  return data;
}

function priceFor(plan: { price_cents: number; price_cents_annual: number }, cycle: string | null) {
  return cycle === "annual" ? plan.price_cents_annual : plan.price_cents;
}

export const getPlanChangeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenant = await loadTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plans } = await supabaseAdmin
      .from("plans")
      .select("id, name, description, price_cents, price_cents_annual, monthly_credits, features, sort_order, max_devices, max_numbers, support_priority")
      .eq("is_active", true)
      .eq("is_custom", false)
      .order("sort_order", { ascending: true })
      .order("price_cents", { ascending: true });

    const cycle = tenant.billing_cycle ?? "monthly";
    const current = (plans ?? []).find((p) => p.id === tenant.plan_id) ?? null;
    const currentPrice = current ? priceFor(current, cycle) : 0;

    const options = (plans ?? []).map((p) => {
      const price = priceFor(p, cycle);
      let kind: "current" | "upgrade" | "downgrade" = "downgrade";
      if (p.id === tenant.plan_id) kind = "current";
      else if (price > currentPrice) kind = "upgrade";
      return { ...p, priceForCycle: price, kind };
    });

    return {
      tenantStatus: tenant.status,
      billingCycle: cycle,
      currentPlanId: tenant.plan_id,
      pendingPlanId: tenant.pending_plan_id,
      renewsAt: tenant.subscription_renews_at,
      options,
    };
  });

export const scheduleDowngrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const tenant = await loadTenant(context.userId);
    if (tenant.status !== "active") throw new Error("Ative sua conta antes de trocar de plano.");
    if (data.planId === tenant.plan_id) throw new Error("Este já é o seu plano atual.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: target }, { data: current }] = await Promise.all([
      supabaseAdmin.from("plans").select("id, name, price_cents, price_cents_annual, is_active, is_custom").eq("id", data.planId).maybeSingle(),
      tenant.plan_id
        ? supabaseAdmin.from("plans").select("price_cents, price_cents_annual").eq("id", tenant.plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!target || !target.is_active || target.is_custom) throw new Error("Plano indisponível.");

    const cycle = tenant.billing_cycle ?? "monthly";
    const targetPrice = priceFor(target, cycle);
    const currentPrice = current ? priceFor(current as any, cycle) : 0;
    // Garantia de servidor: só agenda se for de fato mais barato (downgrade).
    // Upgrade tem que passar pelo checkout (cobrança).
    if (targetPrice >= currentPrice) {
      throw new Error("Para subir de plano, use a opção de pagamento (upgrade é cobrado na hora).");
    }

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ pending_plan_id: data.planId })
      .eq("id", tenant.id);
    if (error) throw new Error(error.message);
    return { ok: true, planName: target.name, renewsAt: tenant.subscription_renews_at };
  });

export const cancelScheduledDowngrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenant = await loadTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ pending_plan_id: null })
      .eq("id", tenant.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
