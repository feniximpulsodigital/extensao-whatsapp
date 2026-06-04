import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (data ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) throw new Error("Apenas admin");
}

// ---------- Global config (admin) ----------

export const adminGetAiGlobalConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_global_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const adminUpdateAiGlobalConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      default_model: z.string().min(3).max(100),
      master_system_prompt: z.string().min(1).max(8000),
      default_temperature: z.number().min(0).max(2),
      default_max_tokens: z.number().int().min(50).max(8000),
      enabled: z.boolean(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_global_config")
      .update(data)
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Per-tenant config ----------

export const getMyAiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");

    const { data: cfg } = await supabase
      .from("ai_config")
      .select("*")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    const { data: prompt } = await supabase
      .from("system_prompts")
      .select("id, name, content, is_default")
      .eq("tenant_id", tenant.id)
      .eq("is_default", true)
      .maybeSingle();

    return { tenantId: tenant.id, config: cfg, prompt };
  });

export const updateMyAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().int().min(50).max(8000).optional(),
      auto_reply_enabled: z.boolean().optional(),
      response_delay_ms: z.number().int().min(0).max(60000).optional(),
      prompt_content: z.string().min(1).max(8000).optional(),
      prompt_name: z.string().max(120).optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");

    const cfgPatch: any = {};
    if (data.model !== undefined) cfgPatch.model = data.model;
    if (data.temperature !== undefined) cfgPatch.temperature = data.temperature;
    if (data.max_tokens !== undefined) cfgPatch.max_tokens = data.max_tokens;
    if (data.auto_reply_enabled !== undefined) cfgPatch.auto_reply_enabled = data.auto_reply_enabled;
    if (data.response_delay_ms !== undefined) cfgPatch.response_delay_ms = data.response_delay_ms;

    if (Object.keys(cfgPatch).length > 0) {
      const { error } = await supabase
        .from("ai_config")
        .update(cfgPatch)
        .eq("tenant_id", tenant.id);
      if (error) throw new Error(error.message);
    }

    if (data.prompt_content !== undefined) {
      const { data: existing } = await supabase
        .from("system_prompts")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("is_default", true)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("system_prompts")
          .update({
            content: data.prompt_content,
            name: data.prompt_name ?? "Atendimento padrão",
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("system_prompts")
          .insert({
            tenant_id: tenant.id,
            name: data.prompt_name ?? "Atendimento padrão",
            content: data.prompt_content,
            is_default: true,
          });
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });

// ---------- Knowledge base ----------

export const listMyKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tenant } = await supabase
      .from("tenants").select("id").eq("owner_id", userId).maybeSingle();
    if (!tenant) return [];
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertMyKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      question: z.string().min(1).max(500),
      answer: z.string().min(1).max(4000),
      tags: z.array(z.string().min(1).max(40)).max(20).optional(),
      is_active: z.boolean().optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: tenant } = await supabase
      .from("tenants").select("id").eq("owner_id", userId).maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");
    const payload = {
      tenant_id: tenant.id,
      question: data.question,
      answer: data.answer,
      tags: data.tags ?? [],
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await supabase
        .from("knowledge_base").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("knowledge_base").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteMyKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: tenant } = await supabase
      .from("tenants").select("id").eq("owner_id", userId).maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");
    const { error } = await supabase
      .from("knowledge_base").delete().eq("id", data.id).eq("tenant_id", tenant.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
