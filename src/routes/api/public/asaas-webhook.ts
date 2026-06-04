import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Read configured webhook token
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("asaas_webhook_token")
          .limit(1)
          .maybeSingle();

        const expected = settings?.asaas_webhook_token;
        const provided = request.headers.get("asaas-access-token");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as {
          event?: string;
          payment?: {
            id: string;
            status: string;
            value: number;
            subscription?: string;
            externalReference?: string;
          };
        };

        const event = body.event;
        const payment = body.payment;
        if (!event || !payment) return new Response("ok");

        // Find our payment row by asaas_payment_id, or create one from the externalReference (subscription renewals)
        let { data: row } = await supabaseAdmin
          .from("payments")
          .select("id, tenant_id, plan_id, status, billing_cycle, amount_cents")
          .eq("asaas_payment_id", payment.id)
          .maybeSingle();

        let tenantId = row?.tenant_id ?? null;
        if (!row && payment.externalReference) {
          tenantId = payment.externalReference;
        }

        const isPaid = event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
        const isFailed = event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED";

        if (!row && tenantId && isPaid) {
          // Subscription renewal — create a payments row
          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("plan_id, billing_cycle")
            .eq("id", tenantId)
            .maybeSingle();
          const ins = await supabaseAdmin
            .from("payments")
            .insert({
              tenant_id: tenantId,
              plan_id: tenant?.plan_id ?? null,
              asaas_payment_id: payment.id,
              amount_cents: Math.round(payment.value * 100),
              status: "paid",
              billing_type: "CREDIT_CARD",
              billing_cycle: tenant?.billing_cycle ?? "monthly",
              paid_at: new Date().toISOString(),
            })
            .select("id, tenant_id, plan_id, billing_cycle")
            .single();
          row = ins.data as typeof row;
        }

        if (row && isPaid) {
          await supabaseAdmin
            .from("payments")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", row.id);

          // Activate tenant + credit
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("monthly_credits")
            .eq("id", row.plan_id!)
            .maybeSingle();
          const credits = plan?.monthly_credits ?? 0;

          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("credits_balance")
            .eq("id", row.tenant_id)
            .maybeSingle();
          const newBalance = (tenant?.credits_balance ?? 0) + credits;

          const renewsAt = new Date();
          if (row.billing_cycle === "annual") renewsAt.setFullYear(renewsAt.getFullYear() + 1);
          else renewsAt.setMonth(renewsAt.getMonth() + 1);

          await supabaseAdmin
            .from("tenants")
            .update({
              status: "active",
              plan_id: row.plan_id,
              credits_balance: newBalance,
              billing_cycle: row.billing_cycle,
              subscription_started_at: new Date().toISOString(),
              subscription_renews_at: renewsAt.toISOString(),
            })
            .eq("id", row.tenant_id);

          await supabaseAdmin.from("credit_transactions").insert({
            tenant_id: row.tenant_id,
            type: "purchase",
            amount: credits,
            balance_after: newBalance,
            description: `Pagamento confirmado (${row.billing_cycle})`,
            reference_id: row.id,
          });
        }

        if (row && isFailed) {
          await supabaseAdmin
            .from("payments")
            .update({ status: event === "PAYMENT_REFUNDED" ? "refunded" : "failed" })
            .eq("id", row.id);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
