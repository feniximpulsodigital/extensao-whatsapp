import { createFileRoute } from "@tanstack/react-router";

// Endpoint called by pg_cron (or any scheduler) to renew monthly credit
// allowance for active tenants. Idempotent per calendar month per tenant.
//
// Configure pg_cron with the project's anon key in the `apikey` header.
//   SELECT cron.schedule('renew-credits', '0 3 * * *', $$
//     SELECT net.http_post(
//       url := 'https://seu-dominio.com.br/api/public/cron-credits-renew',
//       headers := '{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
//       body := '{}'::jsonb
//     );
//   $$);

export const Route = createFileRoute("/api/public/cron-credits-renew")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();

        // Active tenants that weren't renewed in the last 30 days.
        // (sem filtro de allowance: precisamos pegar quem tem downgrade agendado
        // mesmo que a cota atual seja custom/0)
        const { data: tenants, error } = await supabaseAdmin
          .from("tenants")
          .select("id, credits_balance, credits_monthly_allowance, credits_rollover, last_credits_renewed_at, status, custom_plan_expires_at, plan_id, pending_plan_id")
          .eq("status", "active");
        if (error) return new Response(error.message, { status: 500 });

        let renewed = 0;
        for (const t of tenants ?? []) {
          // Skip expired custom plans
          if (t.custom_plan_expires_at && new Date(t.custom_plan_expires_at).getTime() < now.getTime()) continue;
          if (t.last_credits_renewed_at && t.last_credits_renewed_at > thirtyDaysAgo) continue;

          // Downgrade agendado: aplica o plano pendente nesta renovação.
          // A cota mensal passa a ser a do novo plano (a menos que haja
          // override custom em credits_monthly_allowance, que prevalece).
          let planId = t.plan_id;
          let appliedDowngrade = false;
          let allowance = t.credits_monthly_allowance ?? 0;
          if (t.pending_plan_id) {
            const { data: newPlan } = await supabaseAdmin
              .from("plans")
              .select("monthly_credits")
              .eq("id", t.pending_plan_id)
              .maybeSingle();
            planId = t.pending_plan_id;
            appliedDowngrade = true;
            if ((t.credits_monthly_allowance ?? 0) === 0) {
              allowance = newPlan?.monthly_credits ?? 0;
            }
          }

          // sem cota a creditar e sem downgrade pendente: nada a fazer
          if (allowance <= 0 && !appliedDowngrade) continue;

          const newBalance = t.credits_rollover
            ? (t.credits_balance ?? 0) + allowance
            : allowance;

          await supabaseAdmin
            .from("tenants")
            .update({
              credits_balance: newBalance,
              last_credits_renewed_at: now.toISOString(),
              ...(appliedDowngrade ? { plan_id: planId, pending_plan_id: null } : {}),
            })
            .eq("id", t.id);

          if (allowance > 0) {
            await supabaseAdmin.from("credit_transactions").insert({
              tenant_id: t.id,
              type: "purchase" as any,
              amount: allowance,
              balance_after: newBalance,
              description: appliedDowngrade ? "Renovação mensal (novo plano)" : "Renovação mensal da cota",
            });
          }
          renewed++;
        }
        return new Response(JSON.stringify({ ok: true, renewed }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
