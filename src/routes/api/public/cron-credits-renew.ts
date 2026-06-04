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

        // Active tenants that have an allowance and weren't renewed in the last 30 days
        const { data: tenants, error } = await supabaseAdmin
          .from("tenants")
          .select("id, credits_balance, credits_monthly_allowance, credits_rollover, last_credits_renewed_at, status, custom_plan_expires_at")
          .eq("status", "active")
          .gt("credits_monthly_allowance", 0);
        if (error) return new Response(error.message, { status: 500 });

        let renewed = 0;
        for (const t of tenants ?? []) {
          // Skip expired custom plans
          if (t.custom_plan_expires_at && new Date(t.custom_plan_expires_at).getTime() < now.getTime()) continue;
          if (t.last_credits_renewed_at && t.last_credits_renewed_at > thirtyDaysAgo) continue;

          const newBalance = t.credits_rollover
            ? (t.credits_balance ?? 0) + t.credits_monthly_allowance
            : t.credits_monthly_allowance;

          await supabaseAdmin
            .from("tenants")
            .update({
              credits_balance: newBalance,
              last_credits_renewed_at: now.toISOString(),
            })
            .eq("id", t.id);

          await supabaseAdmin.from("credit_transactions").insert({
            tenant_id: t.id,
            type: "purchase" as any,
            amount: t.credits_monthly_allowance,
            balance_after: newBalance,
            description: "Renovação mensal da cota",
          });
          renewed++;
        }
        return new Response(JSON.stringify({ ok: true, renewed }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
