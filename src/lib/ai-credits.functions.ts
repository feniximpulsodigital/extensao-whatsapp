import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado");
}

// ---------------- Client-facing ----------------

export const getMyCreditsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, credits_balance, credits_monthly_allowance, plan_id, plans(low_balance_threshold_pct)")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) return null;
    const allowance = tenant.credits_monthly_allowance ?? 0;
    const balance = tenant.credits_balance ?? 0;
    const threshold = (tenant.plans as any)?.low_balance_threshold_pct ?? 15;
    const pct = allowance > 0 ? Math.round((balance / allowance) * 100) : 100;
    return {
      balance,
      allowance,
      pctRemaining: pct,
      lowBalance: allowance > 0 && pct <= threshold,
      threshold,
    };
  });

export const listMyCreditPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("credit_packages")
      .select("id, name, description, credits, bonus_credits, price_cents, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const buyCreditPackagePix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ packageId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asaasFetch } = await import("./asaas.server");

    const { data: pkg } = await supabaseAdmin
      .from("credit_packages")
      .select("id, name, price_cents, credits, bonus_credits")
      .eq("id", data.packageId)
      .maybeSingle();
    if (!pkg) throw new Error("Pacote inválido");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, asaas_customer_id, company_name")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");

    let customerId = tenant.asaas_customer_id;
    if (!customerId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", userId)
        .maybeSingle();
      const cust = await asaasFetch<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: profile?.full_name || tenant.company_name,
          email: profile?.email,
          mobilePhone: profile?.phone || undefined,
          externalReference: tenant.id,
        }),
      });
      customerId = cust.id;
      await supabaseAdmin.from("tenants").update({ asaas_customer_id: customerId }).eq("id", tenant.id);
    }

    const due = new Date();
    due.setDate(due.getDate() + 2);
    const charge = await asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: pkg.price_cents / 100,
        dueDate: due.toISOString().slice(0, 10),
        description: `Pacote de créditos — ${pkg.name}`,
        externalReference: tenant.id,
      }),
    });
    const qr = await asaasFetch<{ encodedImage: string; payload: string }>(`/payments/${charge.id}/pixQrCode`);

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        tenant_id: tenant.id,
        package_id: pkg.id,
        kind: "credit_pack",
        asaas_payment_id: charge.id,
        amount_cents: pkg.price_cents,
        status: "pending",
        billing_type: "PIX",
        invoice_url: charge.invoiceUrl,
        due_date: due.toISOString().slice(0, 10),
        pix_qr_code: qr.encodedImage,
        pix_copy_paste: qr.payload,
        description: pkg.name,
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

// ---------------- Admin: pricing config ----------------

export const adminGetPricingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase
      .from("ai_pricing_config")
      .select("id, usd_to_brl, credits_per_usd, global_markup_multiplier, model_cost_overrides, updated_at")
      .limit(1)
      .maybeSingle();
    return data;
  });

export const adminUpdatePricingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      usd_to_brl: z.number().positive(),
      credits_per_usd: z.number().int().positive(),
      global_markup_multiplier: z.number().positive(),
      model_cost_overrides: z.record(z.string(), z.object({
        input_per_1k: z.number().min(0),
        output_per_1k: z.number().min(0),
      })),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: existing } = await supabase.from("ai_pricing_config").select("id").limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("ai_pricing_config").update(data as any).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("ai_pricing_config").insert({ singleton: true, ...data } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------------- Admin: credit packages CRUD ----------------

export const adminListCreditPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("credit_packages")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertCreditPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      credits: z.number().int().min(0),
      bonus_credits: z.number().int().min(0).default(0),
      price_cents: z.number().int().min(0),
      markup_multiplier: z.number().positive().nullable().optional(),
      is_active: z.boolean().default(true),
      sort_order: z.number().int().default(0),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await supabase.from("credit_packages").update(patch as any).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("credit_packages").insert(data as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteCreditPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("credit_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Admin: preços automáticos de modelos ----------------

export const adminListModelPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_model_prices")
      .select("model, provider, input_per_1k, output_per_1k, updated_at")
      .order("provider")
      .order("model");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminRefreshModelPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { refreshModelPrices } = await import("./ai-model-prices.server");
    return refreshModelPrices();
  });

// ---------------- Admin: usage report ----------------

export const adminUsageReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tenantId: z.string().uuid().optional(),
      days: z.number().int().min(1).max(365).default(30),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let q = supabase
      .from("ai_usage_log")
      .select("tenant_id, model, input_tokens, output_tokens, cost_usd_real, credits_charged, created_at, tenants(company_name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
