// Preços por modelo buscados automaticamente da base comunitária do LiteLLM
// (o padrão de mercado para preços de LLMs, atualizada continuamente).
// Server-only: importar apenas em server fns / route handlers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LITELLM_PRICES_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

// provedores suportados pelo sistema, em ordem de prioridade quando o mesmo
// nome de modelo existir em mais de um
const PROVIDERS = ["openai", "anthropic", "groq", "gemini"] as const;

const REFRESH_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type ModelPrice = { input_per_1k: number; output_per_1k: number };

export async function refreshModelPrices(): Promise<{ updated: number }> {
  const r = await fetch(LITELLM_PRICES_URL);
  if (!r.ok) throw new Error(`Falha ao buscar preços (HTTP ${r.status})`);
  const raw = (await r.json()) as Record<string, any>;

  // normaliza: remove prefixo "provedor/" e resolve conflitos por prioridade
  const byModel = new Map<string, { provider: string; input: number; output: number; prio: number }>();
  for (const [key, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object") continue;
    const provider = String(v.litellm_provider ?? "");
    const prio = PROVIDERS.indexOf(provider as (typeof PROVIDERS)[number]);
    if (prio === -1) continue;
    if (v.mode !== "chat") continue;
    const input = Number(v.input_cost_per_token);
    const output = Number(v.output_cost_per_token);
    if (!isFinite(input) || !isFinite(output) || (input === 0 && output === 0)) continue;
    const model = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
    const existing = byModel.get(model);
    if (existing && existing.prio <= prio) continue;
    byModel.set(model, { provider, input, output, prio });
  }
  if (byModel.size === 0) throw new Error("Nenhum preço encontrado na base");

  const now = new Date().toISOString();
  const rows = [...byModel.entries()].map(([model, p]) => ({
    model,
    provider: p.provider,
    input_per_1k: p.input * 1000,
    output_per_1k: p.output * 1000,
    source: "litellm",
    updated_at: now,
  }));

  // upsert em lotes para não estourar o tamanho da requisição
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("ai_model_prices")
      .upsert(rows.slice(i, i + 200), { onConflict: "model" });
    if (error) throw new Error(error.message);
  }
  return { updated: rows.length };
}

let refreshEmAndamento = false;
let ultimoRefreshTentado = 0;

/**
 * Preço automático do modelo. Se o registro estiver velho (ou ausente),
 * dispara uma atualização em segundo plano — a chamada atual usa o que
 * houver e as próximas pegam o preço fresco.
 */
export async function getAutoModelPrice(model: string): Promise<ModelPrice | null> {
  const { data } = await supabaseAdmin
    .from("ai_model_prices")
    .select("input_per_1k, output_per_1k, updated_at")
    .eq("model", model)
    .maybeSingle();

  const idade = data ? Date.now() - new Date(data.updated_at).getTime() : Infinity;
  if (idade > REFRESH_TTL_MS && !refreshEmAndamento && Date.now() - ultimoRefreshTentado > 10 * 60 * 1000) {
    refreshEmAndamento = true;
    ultimoRefreshTentado = Date.now();
    refreshModelPrices()
      .catch((e) => console.error("refreshModelPrices:", e))
      .finally(() => { refreshEmAndamento = false; });
  }

  if (!data) return null;
  return { input_per_1k: Number(data.input_per_1k), output_per_1k: Number(data.output_per_1k) };
}
