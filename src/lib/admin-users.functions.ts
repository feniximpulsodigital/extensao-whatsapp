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

function randomToken(len = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

// ---------------- Create invite ----------------

export const adminCreateInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
      companyName: z.string().min(1),
      phone: z.string().optional(),
      planId: z.string().uuid().nullable().optional(),
      billingCycle: z.enum(["monthly", "annual", "free"]).default("monthly"),
      customAllowance: z.number().int().min(0).optional(),
      amountCents: z.number().int().min(0).default(0),
      expiresInDays: z.number().int().min(1).max(90).default(7),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the auth user with a temporary random password
    const tempPwd = randomToken(20);
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPwd,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, company_name: data.companyName, phone: data.phone },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Falha ao criar usuário");
    }
    const newUserId = created.data.user.id;

    // The handle_new_user trigger created the tenant. Fetch + update it.
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("owner_id", newUserId)
      .maybeSingle();
    if (tErr || !tenant) throw new Error("Tenant não foi criado pelo trigger");

    const status = data.amountCents === 0 ? "pending_activation" : "pending_payment";
    await supabaseAdmin
      .from("tenants")
      .update({
        plan_id: data.planId ?? null,
        billing_cycle: data.billingCycle === "free" ? null : data.billingCycle,
        credits_monthly_allowance: data.customAllowance ?? 0,
        status: status as any,
        created_by_admin: true,
      })
      .eq("id", tenant.id);

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 3600 * 1000);
    const { data: invite, error: iErr } = await supabaseAdmin
      .from("client_invites")
      .insert({
        token,
        tenant_id: tenant.id,
        plan_id: data.planId ?? null,
        billing_cycle: data.billingCycle,
        email: data.email,
        full_name: data.fullName,
        company_name: data.companyName,
        phone: data.phone,
        custom_allowance: data.customAllowance ?? null,
        amount_cents: data.amountCents,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        user_id: newUserId,
      })
      .select("id, token")
      .single();
    if (iErr) throw new Error(iErr.message);

    return { id: invite.id, token: invite.token };
  });

// ---------------- List / revoke ----------------

export const adminListInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("client_invites")
      .select("id, token, email, full_name, company_name, billing_cycle, amount_cents, status, expires_at, created_at, accepted_at, tenant_id, plan_id, plans(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminRevokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("client_invites")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Update tenant ----------------

export const adminUpdateTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tenantId: z.string().uuid(),
      status: z.string().optional(),
      plan_id: z.string().uuid().nullable().optional(),
      credits_monthly_allowance: z.number().int().min(0).optional(),
      credits_rollover: z.boolean().optional(),
      custom_plan_expires_at: z.string().nullable().optional(),
      billing_cycle: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { tenantId, ...patch } = data;
    const { error } = await supabase.from("tenants").update(patch as any).eq("id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Add credits manually ----------------

export const adminAddCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tenantId: z.string().uuid(),
      amount: z.number().int(),
      description: z.string().optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("credits_balance")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (tErr || !t) throw new Error("Tenant não encontrado");
    const newBalance = Math.max(0, (t.credits_balance ?? 0) + data.amount);
    await supabaseAdmin.from("tenants").update({ credits_balance: newBalance }).eq("id", data.tenantId);
    await supabaseAdmin.from("credit_transactions").insert({
      tenant_id: data.tenantId,
      type: (data.amount >= 0 ? "bonus" : "adjustment") as any,
      amount: data.amount,
      balance_after: newBalance,
      description: data.description ?? "Ajuste manual do admin",
    });
    return { ok: true, balance: newBalance };
  });

// ---------------- Reset password ----------------

export const adminGeneratePasswordLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (r.error) throw new Error(r.error.message);
    return { actionLink: r.data.properties?.action_link };
  });
