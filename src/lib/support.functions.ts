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

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenant = await getMyTenant(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tickets, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, subject, status, priority, created_at, last_message_at")
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
        "id, subject, status, priority, created_at, last_message_at, tenant_id, tenants(company_name, plans!tenants_plan_id_fkey(name))",
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
        "id, subject, status, priority, created_at, last_message_at, tenant_id, tenants(company_name, whatsapp_numbers, plans!tenants_plan_id_fkey(name))",
      )
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket não encontrado");
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
    return { ticket, messages: messages ?? [] };
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
