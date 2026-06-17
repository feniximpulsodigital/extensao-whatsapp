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

    await supabaseAdmin
      .from("tenants")
      .update({
        plan_id: data.planId ?? null,
        billing_cycle: data.billingCycle === "free" ? null : data.billingCycle,
        credits_monthly_allowance: data.customAllowance ?? 0,
        status: "pending_payment" as any,
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
    // trocar o plano manualmente cancela um downgrade agendado (admin é autoritativo)
    const finalPatch: any = { ...patch };
    if (patch.plan_id !== undefined) finalPatch.pending_plan_id = null;
    const { error } = await supabase.from("tenants").update(finalPatch).eq("id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Delete tenant (destrutivo) ----------------

// Exclui o cliente por completo: cancela a assinatura no Asaas (se houver) e
// remove o usuário de login. Como tenants.owner_id e todas as tabelas-filhas
// têm ON DELETE CASCADE, apagar o auth.user derruba tenant, créditos, tickets,
// base de conhecimento e pagamentos em cadeia. Ação irreversível.
export const adminDeleteTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, owner_id, asaas_subscription_id")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (!tenant) throw new Error("Cliente não encontrado");

    // Trava de segurança: nunca apagar a si mesmo nem outro admin.
    if (tenant.owner_id === userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    const { data: ownerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", tenant.owner_id)
      .eq("role", "admin")
      .maybeSingle();
    if (ownerRole) throw new Error("Não é possível excluir uma conta de administrador.");

    // Cancela a assinatura recorrente no Asaas para não seguir cobrando o cartão.
    if (tenant.asaas_subscription_id) {
      try {
        const { asaasFetch } = await import("./asaas.server");
        await asaasFetch(`/subscriptions/${tenant.asaas_subscription_id}`, { method: "DELETE" });
      } catch {
        // best-effort: se o cancelamento falhar, segue a exclusão; o admin pode
        // cancelar manualmente no painel do Asaas.
      }
    }

    // Apaga o usuário de login → cascata remove tenant e tudo relacionado.
    const del = await supabaseAdmin.auth.admin.deleteUser(tenant.owner_id);
    if (del.error) {
      // fallback: se por algum motivo o auth user não existir, apaga o tenant direto
      const { error: tErr } = await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      if (tErr) throw new Error(del.error.message);
    }
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
  .inputValidator((input) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("owner_id")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", tenant.owner_id)
      .maybeSingle();
    if (!profile?.email) throw new Error("E-mail do cliente não encontrado");
    const r = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });
    if (r.error) throw new Error(r.error.message);
    return { actionLink: r.data.properties?.action_link };
  });
