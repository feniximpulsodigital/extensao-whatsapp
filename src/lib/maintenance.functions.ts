import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminGuard(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado");
}

// Consulta leve que só precisa "tocar" o banco — mantém o projeto Supabase
// ativo e evita a pausa automática por inatividade dos planos gratuitos.
export async function runDbKeepAlive(): Promise<{ ok: boolean; tenantsCount: number | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { count, error } = await supabaseAdmin
      .from("tenants")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("maintenance_runs").insert({
      status: "ok",
      detail: "Verificação de rotina concluída",
      tenants_count: count ?? 0,
    });
    return { ok: true, tenantsCount: count ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("maintenance_runs").insert({
      status: "error",
      detail: message,
      tenants_count: null,
    });
    return { ok: false, tenantsCount: null };
  }
}

export const getMaintenanceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("maintenance_runs")
      .select("id, ran_at, status, detail, tenants_count")
      .order("ran_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

export const runMaintenanceNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    return runDbKeepAlive();
  });
