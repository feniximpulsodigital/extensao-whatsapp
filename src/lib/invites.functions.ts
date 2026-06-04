import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public — no auth required.

export const getInviteByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("client_invites")
      .select("id, token, email, full_name, company_name, billing_cycle, amount_cents, status, expires_at, plan_id, plans(name, description, monthly_credits, max_knowledge_entries)")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Convite não encontrado");
    const expired = new Date(invite.expires_at).getTime() < Date.now();
    return {
      id: invite.id,
      email: invite.email,
      fullName: invite.full_name,
      companyName: invite.company_name,
      billingCycle: invite.billing_cycle,
      amountCents: invite.amount_cents,
      status: invite.status,
      expired,
      plan: invite.plans
        ? {
            name: (invite.plans as any).name,
            description: (invite.plans as any).description,
            monthlyCredits: (invite.plans as any).monthly_credits,
          }
        : null,
    };
  });

export const acceptInviteSetPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      token: z.string().min(10),
      password: z.string().min(8),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error } = await supabaseAdmin
      .from("client_invites")
      .select("id, status, expires_at, user_id, tenant_id, amount_cents, plan_id, billing_cycle, custom_allowance, email")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !invite) throw new Error("Convite inválido");
    if (invite.status === "revoked") throw new Error("Convite revogado");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Convite expirado");
    if (!invite.user_id) throw new Error("Convite sem usuário vinculado");

    // Set the password
    const upd = await supabaseAdmin.auth.admin.updateUserById(invite.user_id, {
      password: data.password,
    });
    if (upd.error) throw new Error(upd.error.message);

    // If free plan → activate tenant now and credit allowance
    if (invite.amount_cents === 0) {
      const allowance = invite.custom_allowance ?? 0;
      const renewsAt = new Date();
      renewsAt.setMonth(renewsAt.getMonth() + 1);
      await supabaseAdmin
        .from("tenants")
        .update({
          status: "active" as any,
          credits_balance: allowance,
          subscription_started_at: new Date().toISOString(),
          subscription_renews_at: renewsAt.toISOString(),
          last_credits_renewed_at: new Date().toISOString(),
        })
        .eq("id", invite.tenant_id);
      if (allowance > 0) {
        await supabaseAdmin.from("credit_transactions").insert({
          tenant_id: invite.tenant_id,
          type: "bonus" as any,
          amount: allowance,
          balance_after: allowance,
          description: "Plano cortesia ativado via convite",
        });
      }
    }

    await supabaseAdmin
      .from("client_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return {
      ok: true,
      email: invite.email,
      requiresPayment: invite.amount_cents > 0,
    };
  });

export const createInvitePixPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asaasFetch } = await import("./asaas.server");

    const { data: invite } = await supabaseAdmin
      .from("client_invites")
      .select("id, tenant_id, plan_id, billing_cycle, amount_cents, email, full_name, company_name, phone, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("Convite inválido");
    if (invite.amount_cents <= 0) throw new Error("Convite sem cobrança");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, asaas_customer_id, document")
      .eq("id", invite.tenant_id)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");

    let customerId = tenant.asaas_customer_id;
    if (!customerId) {
      const cust = await asaasFetch<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: invite.full_name ?? invite.company_name,
          email: invite.email,
          mobilePhone: invite.phone ?? undefined,
          externalReference: tenant.id,
        }),
      });
      customerId = cust.id;
      await supabaseAdmin.from("tenants").update({ asaas_customer_id: customerId }).eq("id", tenant.id);
    }

    const due = new Date();
    due.setDate(due.getDate() + 3);

    const charge = await asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: invite.amount_cents / 100,
        dueDate: due.toISOString().slice(0, 10),
        description: `Ativação de conta — ${invite.company_name ?? invite.email}`,
        externalReference: tenant.id,
      }),
    });

    const qr = await asaasFetch<{ encodedImage: string; payload: string }>(`/payments/${charge.id}/pixQrCode`);

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        tenant_id: tenant.id,
        plan_id: invite.plan_id,
        invite_id: invite.id,
        kind: "invite",
        asaas_payment_id: charge.id,
        amount_cents: invite.amount_cents,
        status: "pending",
        billing_type: "PIX",
        billing_cycle: invite.billing_cycle === "free" ? "monthly" : invite.billing_cycle,
        invoice_url: charge.invoiceUrl,
        due_date: due.toISOString().slice(0, 10),
        pix_qr_code: qr.encodedImage,
        pix_copy_paste: qr.payload,
        description: `Convite ${invite.id}`,
      })
      .select("id")
      .single();
    if (payErr) throw new Error(payErr.message);

    return {
      paymentId: payment.id,
      pixQrCode: qr.encodedImage,
      pixCopyPaste: qr.payload,
      invoiceUrl: charge.invoiceUrl,
    };
  });

export const checkInvitePayment = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("id", data.paymentId)
      .maybeSingle();
    return { status: p?.status ?? "pending" };
  });
