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

// ---------------- Cliente ----------------

// Aviso ativo mais recente (um por vez). Usado no banner do painel.
export const getActiveAnnouncement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, level, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

// ---------------- Admin ----------------

export const adminGetAnnouncement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, level, is_active, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

// Salva o aviso: desativa os anteriores e grava o novo como ativo (ou apenas
// desativa tudo, se o corpo vier vazio com active=false).
export const adminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().trim().max(120).optional(),
        body: z.string().trim().max(2000),
        level: z.enum(["info", "warning", "critical"]).default("info"),
        isActive: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Um aviso ativo por vez: desativa todos antes de inserir um novo ativo.
    await supabaseAdmin
      .from("announcements")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true);

    if (!data.isActive || !data.body) {
      // Apenas desativou (mensagem vazia ou desligada) — nada a inserir.
      return { ok: true, active: false };
    }

    const { error } = await supabaseAdmin.from("announcements").insert({
      title: data.title || null,
      body: data.body,
      level: data.level,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true, active: true };
  });

export const adminClearAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("announcements")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true);
    return { ok: true };
  });
