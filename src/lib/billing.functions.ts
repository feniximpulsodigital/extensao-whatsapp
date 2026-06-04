import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- Public/auth queries ----------------

export const getMyTenant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tenants")
      .select("id, status, credits_balance, plan_id, billing_cycle, asaas_customer_id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const listActivePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, description, price_cents, price_cents_annual, monthly_credits, max_knowledge_entries, features, sort_order")
      .eq("is_active", true)
      .eq("is_custom", false)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------------- Asaas customer ----------------

async function ensureAsaasCustomer(adminSupa: any, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asaasFetch } = await import("./asaas.server");
  void adminSupa;

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, asaas_customer_id, company_name, document")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!tenant) throw new Error("Tenant não encontrado");
  if (tenant.asaas_customer_id) return tenant;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();

  const created = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: profile?.full_name || tenant.company_name,
      email: profile?.email,
      mobilePhone: profile?.phone || undefined,
      cpfCnpj: tenant.document || undefined,
      externalReference: tenant.id,
    }),
  });

  await supabaseAdmin
    .from("tenants")
    .update({ asaas_customer_id: created.id })
    .eq("id", tenant.id);

  return { ...tenant, asaas_customer_id: created.id };
}

// ---------------- PIX charge ----------------

export const createPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      planId: z.string().uuid(),
      billingCycle: z.enum(["monthly", "annual"]),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asaasFetch } = await import("./asaas.server");

    const { data: plan, error: pErr } = await supabaseAdmin
      .from("plans")
      .select("id, name, price_cents, price_cents_annual")
      .eq("id", data.planId)
      .maybeSingle();
    if (pErr || !plan) throw new Error("Plano inválido");
    const amountCents = data.billingCycle === "annual" ? plan.price_cents_annual : plan.price_cents;
    if (!amountCents || amountCents <= 0) throw new Error("Plano sem preço configurado");

    const tenant = await ensureAsaasCustomer(supabaseAdmin, userId);

    const due = new Date();
    due.setDate(due.getDate() + 1);

    const charge = await asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: tenant.asaas_customer_id,
        billingType: "PIX",
        value: amountCents / 100,
        dueDate: due.toISOString().slice(0, 10),
        description: `${plan.name} — ${data.billingCycle === "annual" ? "Anual" : "Mensal"}`,
        externalReference: tenant.id,
      }),
    });

    const qr = await asaasFetch<{ encodedImage: string; payload: string }>(
      `/payments/${charge.id}/pixQrCode`
    );

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        tenant_id: tenant.id,
        plan_id: plan.id,
        asaas_payment_id: charge.id,
        amount_cents: amountCents,
        status: "pending",
        billing_type: "PIX",
        billing_cycle: data.billingCycle,
        invoice_url: charge.invoiceUrl,
        due_date: due.toISOString().slice(0, 10),
        pix_qr_code: qr.encodedImage,
        pix_copy_paste: qr.payload,
        description: `${plan.name} — ${data.billingCycle === "annual" ? "Anual" : "Mensal"}`,
      })
      .select("id")
      .single();
    if (payErr) throw new Error(payErr.message);

    return {
      paymentId: payment.id,
      asaasPaymentId: charge.id,
      invoiceUrl: charge.invoiceUrl,
      pixQrCode: qr.encodedImage,
      pixCopyPaste: qr.payload,
    };
  });

// ---------------- Card subscription ----------------

export const createCardSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      planId: z.string().uuid(),
      billingCycle: z.enum(["monthly", "annual"]),
      holderName: z.string().min(1),
      cardNumber: z.string().min(13).max(19),
      expiryMonth: z.string().length(2),
      expiryYear: z.string().length(4),
      ccv: z.string().min(3).max(4),
      holderEmail: z.string().email(),
      holderCpfCnpj: z.string().min(11),
      holderPostalCode: z.string().min(8),
      holderAddressNumber: z.string().min(1),
      holderPhone: z.string().min(10),
      remoteIp: z.string().optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asaasFetch } = await import("./asaas.server");

    const { data: plan, error: pErr } = await supabaseAdmin
      .from("plans")
      .select("id, name, price_cents, price_cents_annual")
      .eq("id", data.planId)
      .maybeSingle();
    if (pErr || !plan) throw new Error("Plano inválido");
    const amountCents = data.billingCycle === "annual" ? plan.price_cents_annual : plan.price_cents;
    if (!amountCents || amountCents <= 0) throw new Error("Plano sem preço configurado");

    const tenant = await ensureAsaasCustomer(supabaseAdmin, userId);

    const next = new Date();
    next.setDate(next.getDate() + 1);

    const sub = await asaasFetch<{ id: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: tenant.asaas_customer_id,
        billingType: "CREDIT_CARD",
        value: amountCents / 100,
        nextDueDate: next.toISOString().slice(0, 10),
        cycle: data.billingCycle === "annual" ? "YEARLY" : "MONTHLY",
        description: `${plan.name} — ${data.billingCycle === "annual" ? "Anual" : "Mensal"}`,
        externalReference: tenant.id,
        creditCard: {
          holderName: data.holderName,
          number: data.cardNumber.replace(/\s/g, ""),
          expiryMonth: data.expiryMonth,
          expiryYear: data.expiryYear,
          ccv: data.ccv,
        },
        creditCardHolderInfo: {
          name: data.holderName,
          email: data.holderEmail,
          cpfCnpj: data.holderCpfCnpj.replace(/\D/g, ""),
          postalCode: data.holderPostalCode.replace(/\D/g, ""),
          addressNumber: data.holderAddressNumber,
          phone: data.holderPhone.replace(/\D/g, ""),
        },
        remoteIp: data.remoteIp,
      }),
    });

    await supabaseAdmin
      .from("tenants")
      .update({
        asaas_subscription_id: sub.id,
        plan_id: plan.id,
        billing_cycle: data.billingCycle,
      })
      .eq("id", tenant.id);

    return { subscriptionId: sub.id };
  });

// ---------------- Polling ----------------

export const checkPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: payment, error } = await supabase
      .from("payments")
      .select("id, status, tenant_id, tenants!inner(owner_id)")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payment) throw new Error("Pagamento não encontrado");
    const owner = (payment as unknown as { tenants: { owner_id: string } }).tenants.owner_id;
    if (owner !== userId) throw new Error("Sem acesso");
    return { status: payment.status };
  });

// ---------------- Admin: settings ----------------

const adminGuard = async (supabase: any, userId: string) => {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado");
};

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { data, error } = await supabase
      .from("app_settings")
      .select("id, asaas_env, asaas_api_key_sandbox, asaas_api_key_production, asaas_webhook_token, updated_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      asaas_env: z.enum(["sandbox", "production"]),
      asaas_api_key_sandbox: z.string().nullable().optional(),
      asaas_api_key_production: z.string().nullable().optional(),
      asaas_webhook_token: z.string().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { data: existing } = await supabase.from("app_settings").select("id").limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("app_settings").update(data).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("app_settings").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------------- Admin: plans CRUD ----------------

export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { data, error } = await supabase.from("plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      price_cents: z.number().int().min(0),
      price_cents_annual: z.number().int().min(0),
      monthly_credits: z.number().int().min(0),
      max_knowledge_entries: z.number().int().min(0),
      is_active: z.boolean(),
      sort_order: z.number().int(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await supabase.from("plans").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("plans").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { error } = await supabase.from("plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Admin: tenants list ----------------

export const adminListTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { data, error } = await supabase
      .from("tenants")
      .select("id, company_name, status, credits_balance, billing_cycle, created_at, plans(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
