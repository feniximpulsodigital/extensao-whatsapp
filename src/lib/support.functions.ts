import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Suporte por tickets: o cliente abre/responde, o admin atende numa fila
// ordenada pela prioridade do plano (snapshot gravado no ticket na abertura).

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado");
}

async function getMyTenant(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tenants")
    .select("id, plans!tenants_plan_id_fkey(support_priority)")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Conta sem empresa vinculada");
  return data;
}

// Garantia de reembolso (dias) — deve bater com GUARANTEE_DAYS da landing.
const REFUND_WINDOW_DAYS = 7;

// ---------------- Cliente ----------------

export const createMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subject: z.string().trim().min(3).max(150),
        message: z.string().trim().min(5).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const tenant = await getMyTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const priority = (tenant.plans as { support_priority: number } | null)?.support_priority ?? 1;
    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ tenant_id: tenant.id, subject: data.subject, priority, status: "open" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await supabaseAdmin
      .from("support_messages")
      .insert({ ticket_id: ticket.id, sender: "client", body: data.message });
    if (mErr) throw new Error(mErr.message);
    return { ok: true, ticketId: ticket.id };
  });

// Elegibilidade de reembolso: dentro de REFUND_WINDOW_DAYS desde o início da
// assinatura e sem pedido de reembolso ainda em aberto.
export const getMyRefundEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, subscription_started_at, created_at")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!tenant) return { eligible: false, reason: "no-tenant" as const, daysLeft: 0 };

    const start = tenant.subscription_started_at ?? tenant.created_at;
    const startMs = new Date(start).getTime();
    const deadlineMs = startMs + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const daysLeft = Math.max(0, Math.ceil((deadlineMs - Date.now()) / (24 * 60 * 60 * 1000)));
    const withinWindow = Date.now() <= deadlineMs;

    const { data: existing } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("category", "refund")
      .neq("status", "closed")
      .limit(1);
    const hasOpenRefund = (existing ?? []).length > 0;

    return {
      eligible: withinWindow && !hasOpenRefund,
      reason: !withinWindow ? ("expired" as const) : hasOpenRefund ? ("pending" as const) : ("ok" as const),
      daysLeft,
      windowDays: REFUND_WINDOW_DAYS,
    };
  });

// Cliente solicita reembolso: abre um ticket categorizado como "refund".
export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reason: z.string().trim().max(2000).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, subscription_started_at, created_at, plans!tenants_plan_id_fkey(support_priority)")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!tenant) throw new Error("Conta sem empresa vinculada");

    const start = tenant.subscription_started_at ?? tenant.created_at;
    const deadlineMs =
      new Date(start).getTime() + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > deadlineMs) {
      throw new Error(
        `O prazo de garantia de ${REFUND_WINDOW_DAYS} dias já passou. Se precisar, abra um ticket de suporte.`,
      );
    }
    const { data: existing } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("category", "refund")
      .neq("status", "closed")
      .limit(1);
    if ((existing ?? []).length > 0) {
      throw new Error("Você já tem uma solicitação de reembolso em andamento.");
    }

    const priority = (tenant.plans as { support_priority: number } | null)?.support_priority ?? 1;
    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        tenant_id: tenant.id,
        subject: "Solicitação de reembolso (garantia)",
        category: "refund",
        priority,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const body =
      `Solicito o reembolso dentro da garantia de ${REFUND_WINDOW_DAYS} dias.` +
      (data.reason ? `\n\nMotivo: ${data.reason}` : "");
    const { error: mErr } = await supabaseAdmin
      .from("support_messages")
      .insert({ ticket_id: ticket.id, sender: "client", body });
    if (mErr) throw new Error(mErr.message);
    return { ok: true, ticketId: ticket.id };
  });

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenant = await getMyTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tickets, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, subject, status, priority, category, created_at, last_message_at")
      .eq("tenant_id", tenant.id)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = (tickets ?? []).map((t) => t.id);
    let unreadByTicket: Record<string, number> = {};
    if (ids.length) {
      const { data: unread } = await supabaseAdmin
        .from("support_messages")
        .select("ticket_id")
        .in("ticket_id", ids)
        .eq("sender", "admin")
        .is("read_at", null);
      for (const m of unread ?? []) {
        unreadByTicket[m.ticket_id] = (unreadByTicket[m.ticket_id] ?? 0) + 1;
      }
    }
    return (tickets ?? []).map((t) => ({ ...t, unread: unreadByTicket[t.id] ?? 0 }));
  });

export const getMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const tenant = await getMyTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, subject, status, priority, created_at, last_message_at")
      .eq("id", data.ticketId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket não encontrado");
    const { data: messages } = await supabaseAdmin
      .from("support_messages")
      .select("id, sender, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    // abrir o ticket marca as respostas do admin como lidas
    await supabaseAdmin
      .from("support_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("ticket_id", ticket.id)
      .eq("sender", "admin")
      .is("read_at", null);
    return { ticket, messages: messages ?? [] };
  });

export const replyMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ticketId: z.string().uuid(),
        message: z.string().trim().min(1).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const tenant = await getMyTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, status")
      .eq("id", data.ticketId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket não encontrado");
    if (ticket.status === "closed") throw new Error("Ticket encerrado. Abra um novo ticket.");
    const { error } = await supabaseAdmin
      .from("support_messages")
      .insert({ ticket_id: ticket.id, sender: "client", body: data.message });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("support_tickets")
      .update({
        status: "open",
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
    return { ok: true };
  });

export const closeMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const tenant = await getMyTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", data.ticketId)
      .eq("tenant_id", tenant.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Badge do cliente: respostas do admin ainda não lidas
export const getMySupportBadge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!tenant) return { unread: 0 };
    const { count } = await supabaseAdmin
      .from("support_messages")
      .select("id, support_tickets!inner(tenant_id)", { count: "exact", head: true })
      .eq("support_tickets.tenant_id", tenant.id)
      .eq("sender", "admin")
      .is("read_at", null);
    return { unread: count ?? 0 };
  });

// ---------------- Admin ----------------

export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select(
        "id, subject, status, priority, category, created_at, last_message_at, tenant_id, tenants(company_name, plans!tenants_plan_id_fkey(name))",
      )
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // fila: abertos primeiro, depois prioridade do plano, depois quem espera há mais tempo
    const rank: Record<string, number> = { open: 0, answered: 1, closed: 2 };
    return (data ?? []).sort((a, b) => {
      const r = (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
      if (r !== 0) return r;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return new Date(a.last_message_at).getTime() - new Date(b.last_message_at).getTime();
    });
  });

export const adminGetTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select(
        "id, subject, status, priority, category, created_at, last_message_at, tenant_id, tenants(company_name, owner_id, whatsapp_numbers, plans!tenants_plan_id_fkey(name))",
      )
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket não encontrado");
    // Contato do cliente (e-mail/telefone do cadastro) para reembolso/atendimento
    let contact: { email: string | null; phone: string | null } = { email: null, phone: null };
    const ownerId = (ticket.tenants as { owner_id?: string } | null)?.owner_id;
    if (ownerId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, phone")
        .eq("id", ownerId)
        .maybeSingle();
      if (profile) contact = { email: profile.email, phone: profile.phone };
    }
    const { data: messages } = await supabaseAdmin
      .from("support_messages")
      .select("id, sender, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    await supabaseAdmin
      .from("support_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("ticket_id", ticket.id)
      .eq("sender", "client")
      .is("read_at", null);
    return { ticket, messages: messages ?? [], contact };
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ticketId: z.string().uuid(),
        message: z.string().trim().min(1).max(5000),
        close: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_messages")
      .insert({ ticket_id: data.ticketId, sender: "admin", body: data.message });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("support_tickets")
      .update({
        status: data.close ? "closed" : "answered",
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.ticketId);
    return { ok: true };
  });

export const adminCloseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Badge do admin: tickets aguardando resposta
export const adminSupportBadge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    return { open: count ?? 0 };
  });
