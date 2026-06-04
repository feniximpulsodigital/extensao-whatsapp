// Server-only Asaas API client. Reads configuration from app_settings table.
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AsaasConfig = {
  env: "sandbox" | "production";
  apiKey: string;
  webhookToken: string | null;
  baseUrl: string;
};

function adminClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function getAsaasConfig(): Promise<AsaasConfig> {
  const supa = adminClient();
  const { data, error } = await supa
    .from("app_settings")
    .select("asaas_env, asaas_api_key_sandbox, asaas_api_key_production, asaas_webhook_token")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`app_settings: ${error.message}`);
  if (!data) throw new Error("Asaas não configurado. Acesse Admin → Configurações.");

  const env = (data.asaas_env as "sandbox" | "production") ?? "sandbox";
  const apiKey = env === "production" ? data.asaas_api_key_production : data.asaas_api_key_sandbox;
  if (!apiKey) throw new Error(`Chave Asaas (${env}) não cadastrada. Acesse Admin → Configurações.`);

  return {
    env,
    apiKey,
    webhookToken: data.asaas_webhook_token,
    baseUrl: env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3",
  };
}

export async function asaasFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  cfg?: AsaasConfig
): Promise<T> {
  const config = cfg ?? (await getAsaasConfig());
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: config.apiKey,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = (body as { errors?: { description?: string }[] })?.errors?.[0]?.description
      ?? (typeof body === "string" ? body : `Asaas ${res.status}`);
    throw new Error(msg);
  }
  return body as T;
}
