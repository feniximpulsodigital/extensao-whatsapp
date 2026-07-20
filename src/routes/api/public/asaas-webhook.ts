import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

        let { data: row } = await supabaseAdmin
          .from("payments")
          .select("id, tenant_id, plan_id, status, billing_cycle, amount_cents, kind, invite_id, package_id")
          .eq("asaas_payment_id", payment.id)
          .maybeSingle();

        let tenantId = row?.tenant_id ?? null;
        if (!row && payment.externalReference) {
          tenantId = payment.externalReference;
        }

        const isPaid = event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
        const isFailed = event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED";

        // Subscription renewal — synthesize a payments row
        if (!row && tenantId && isPaid) {
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
              status: "confirmed",
              billing_type: "CREDIT_CARD",
              billing_cycle: tenant?.billing_cycle ?? "monthly",
              kind: "subscription",
              paid_at: new Date().toISOString(),
            })
            .select("id, tenant_id, plan_id, billing_cycle, kind, invite_id, package_id, amount_cents, status")
            .single();
          row = ins.data as typeof row;
        }

        if (row && isPaid) {
          await supabaseAdmin
            .from("payments")
            .update({ status: "confirmed", paid_at: new Date().toISOString() })
            .eq("id", row.id);

          // Meta Conversions API — Purchase server-side (não depende do
          // navegador do cliente, funciona mesmo com ad blocker). Não
          // bloqueia o fluxo de pagamento se falhar.
          if (row.tenant_id) {
            const { data: tenantRow } = await supabaseAdmin
              .from("tenants")
              .select("owner_id")
              .eq("id", row.tenant_id)
              .maybeSingle();
            if (tenantRow?.owner_id) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("email, phone")
                .eq("id", tenantRow.owner_id)
                .maybeSingle();
              const { sendMetaCapiEvent } = await import("@/lib/meta-capi.server");
              await sendMetaCapiEvent({
                eventName: "Purchase",
                email: profile?.email ?? null,
                phone: profile?.phone ?? null,
                valueCents: row.amount_cents ?? undefined,
                currency: "BRL",
                eventId: `payment-${payment.id}`,
              });
            }
          }

          // ===== CREDIT PACKAGE =====
          if (row.kind === "credit_pack" && row.package_id) {
            const { data: pkg } = await supabaseAdmin
              .from("credit_packages")
              .select("credits, bonus_credits, name")
              .eq("id", row.package_id)
              .maybeSingle();
            const total = (pkg?.credits ?? 0) + (pkg?.bonus_credits ?? 0);
            const { data: t } = await supabaseAdmin
              .from("tenants")
              .select("credits_balance")
              .eq("id", row.tenant_id)
              .maybeSingle();
            const newBalance = (t?.credits_balance ?? 0) + total;
            await supabaseAdmin.from("tenants").update({ credits_balance: newBalance }).eq("id", row.tenant_id);
            await supabaseAdmin.from("credit_transactions").insert({
              tenant_id: row.tenant_id,
              type: "purchase" as any,
              amount: total,
              balance_after: newBalance,
              description: `Pacote: ${pkg?.name ?? "créditos"}`,
              reference_id: row.id,
            });
            return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
          }

          // ===== INVITE / SUBSCRIPTION (activate tenant + credit plan allowance) =====
          let credits = 0;
          if (row.plan_id) {
            const { data: plan } = await supabaseAdmin
              .from("plans")
              .select("monthly_credits")
              .eq("id", row.plan_id)
              .maybeSingle();
            credits = plan?.monthly_credits ?? 0;
          }
          // Custom allowance on tenant overrides plan if set
          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("credits_balance, credits_monthly_allowance")
            .eq("id", row.tenant_id)
            .maybeSingle();
          const allowance = (tenant?.credits_monthly_allowance ?? 0) > 0
            ? tenant!.credits_monthly_allowance
            : credits;
          const newBalance = (tenant?.credits_balance ?? 0) + allowance;

          const renewsAt = new Date();
          if (row.billing_cycle === "annual") renewsAt.setFullYear(renewsAt.getFullYear() + 1);
          else renewsAt.setMonth(renewsAt.getMonth() + 1);

          await supabaseAdmin
            .from("tenants")
            .update({
              status: "active" as any,
              plan_id: row.plan_id,
              credits_balance: newBalance,
              billing_cycle: row.billing_cycle,
              subscription_started_at: new Date().toISOString(),
              subscription_renews_at: renewsAt.toISOString(),
              last_credits_renewed_at: new Date().toISOString(),
              // pagamento de um plano cancela qualquer downgrade agendado:
              // o cliente acabou de escolher ativamente este plano
              pending_plan_id: null,
            })
            .eq("id", row.tenant_id);

          if (allowance > 0) {
            await supabaseAdmin.from("credit_transactions").insert({
              tenant_id: row.tenant_id,
              type: "purchase" as any,
              amount: allowance,
              balance_after: newBalance,
              description: row.kind === "invite" ? "Ativação via convite" : `Pagamento confirmado (${row.billing_cycle})`,
              reference_id: row.id,
            });
          }

          if (row.invite_id) {
            await supabaseAdmin
              .from("client_invites")
              .update({ status: "paid" })
              .eq("id", row.invite_id);
          }
        }

        if (row && isFailed) {
          await supabaseAdmin
            .from("payments")
            .update({ status: event === "PAYMENT_REFUNDED" ? "refunded" : "failed" })
            .eq("id", row.id);
        }

        // Inadimplência: fatura recorrente venceu sem pagamento → suspende o
        // tenant. A IA para de responder (ai-reply exige status active) até o
        // pagamento ser confirmado, quando o bloco isPaid acima reativa.
        // Só suspende cobrança de assinatura/plano, não pacote de créditos.
        const overdueTenant = tenantId ?? row?.tenant_id ?? null;
        if (event === "PAYMENT_OVERDUE" && overdueTenant && row?.kind !== "credit_pack") {
          await supabaseAdmin
            .from("tenants")
            .update({ status: "suspended" as any })
            .eq("id", overdueTenant)
            .eq("status", "active");
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
