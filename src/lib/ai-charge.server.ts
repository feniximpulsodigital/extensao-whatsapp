// Server-only helper to debit AI usage from a tenant's credit balance.
// Import inside server fn / server route handlers only.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ChargeInput = {
  tenantId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  endpoint?: string;
  metadata?: Record<string, unknown>;
};

export type ChargeResult =
  | { ok: true; creditsCharged: number; balanceAfter: number; costUsdReal: number }
  | { ok: false; error: "INSUFFICIENT_CREDITS"; balance: number; required: number };

export async function chargeAiUsage(input: ChargeInput): Promise<ChargeResult> {
  const { data: cfg } = await supabaseAdmin
    .from("ai_pricing_config")
    .select("usd_to_brl, credits_per_usd, global_markup_multiplier, model_cost_overrides")
    .limit(1)
    .maybeSingle();
  const overrides = (cfg?.model_cost_overrides ?? {}) as Record<
    string,
    { input_per_1k: number; output_per_1k: number }
  >;
  const m = overrides[input.model] ?? { input_per_1k: 0.001, output_per_1k: 0.002 };
  const costUsd =
    (input.inputTokens / 1000) * m.input_per_1k + (input.outputTokens / 1000) * m.output_per_1k;
  const multiplier = Number(cfg?.global_markup_multiplier ?? 2.5);
  const creditsPerUsd = Number(cfg?.credits_per_usd ?? 1000);
  const credits = Math.max(1, Math.ceil(costUsd * multiplier * creditsPerUsd));

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("credits_balance")
    .eq("id", input.tenantId)
    .maybeSingle();
  const balance = tenant?.credits_balance ?? 0;
  if (balance < credits) {
    return { ok: false, error: "INSUFFICIENT_CREDITS", balance, required: credits };
  }
  const newBalance = balance - credits;
  await supabaseAdmin.from("tenants").update({ credits_balance: newBalance }).eq("id", input.tenantId);
  await supabaseAdmin.from("credit_transactions").insert({
    tenant_id: input.tenantId,
    type: "consumption" as any,
    amount: -credits,
    balance_after: newBalance,
    description: `IA · ${input.model}`,
  });
  await supabaseAdmin.from("ai_usage_log").insert({
    tenant_id: input.tenantId,
    model: input.model,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    cost_usd_real: costUsd,
    credits_charged: credits,
    endpoint: input.endpoint ?? null,
    metadata: (input.metadata ?? {}) as any,
  });
  return { ok: true, creditsCharged: credits, balanceAfter: newBalance, costUsdReal: costUsd };
}
