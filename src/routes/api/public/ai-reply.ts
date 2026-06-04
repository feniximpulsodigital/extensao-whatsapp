import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chargeAiUsage } from "@/lib/ai-charge.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, authorization",
};

const BodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(8000),
  })).min(1).max(40),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type Msg = { role: "user" | "assistant" | "system"; content: string };

async function callProvider(opts: {
  provider: "groq" | "openai" | "anthropic";
  model: string;
  temperature: number;
  maxTokens: number;
  system: string;
  messages: Msg[];
}): Promise<{ ok: true; reply: string; inputTokens: number; outputTokens: number } | { ok: false; status: number; error: string }> {
  const { provider, model, temperature, maxTokens, system, messages } = opts;

  if (provider === "groq" || provider === "openai") {
    const key = provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
    if (!key) return { ok: false, status: 500, error: `Falta o secret ${provider === "groq" ? "GROQ_API_KEY" : "OPENAI_API_KEY"}` };
    const url = provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature, max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error(`${provider} error`, r.status, t);
      return { ok: false, status: r.status === 429 ? 429 : 502, error: r.status === 429 ? "Limite de uso atingido" : "Erro no provedor de IA" };
    }
    const j: any = await r.json();
    return {
      ok: true,
      reply: j?.choices?.[0]?.message?.content ?? "",
      inputTokens: Number(j?.usage?.prompt_tokens ?? 0),
      outputTokens: Number(j?.usage?.completion_tokens ?? 0),
    };
  }

  // anthropic
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, status: 500, error: "Falta o secret ANTHROPIC_API_KEY" };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: messages.filter((m) => m.role !== "system").map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("anthropic error", r.status, t);
    return { ok: false, status: r.status === 429 ? 429 : 502, error: r.status === 429 ? "Limite de uso atingido" : "Erro no provedor de IA" };
  }
  const j: any = await r.json();
  const reply = Array.isArray(j?.content) ? j.content.map((c: any) => c?.text ?? "").join("") : "";
  return {
    ok: true,
    reply,
    inputTokens: Number(j?.usage?.input_tokens ?? 0),
    outputTokens: Number(j?.usage?.output_tokens ?? 0),
  };
}

export const Route = createFileRoute("/api/public/ai-reply")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const apiKey = request.headers.get("x-api-key") ?? "";
          if (!apiKey || apiKey.length < 16) return json(401, { error: "Missing x-api-key" });

          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("id, status, credits_balance, owner_id")
            .eq("extension_api_key", apiKey)
            .maybeSingle();
          if (!tenant) return json(401, { error: "Invalid api key" });
          if (tenant.status !== "active") return json(403, { error: "Tenant inactive" });

          let payload: unknown;
          try { payload = await request.json(); } catch { return json(400, { error: "Invalid JSON" }); }
          const parsed = BodySchema.safeParse(payload);
          if (!parsed.success) return json(400, { error: "Invalid body", details: parsed.error.flatten() });

          const [globalCfg, tenantCfg, prompt, kb] = await Promise.all([
            supabaseAdmin.from("ai_global_config").select("*").limit(1).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("ai_config").select("*").eq("tenant_id", tenant.id).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("system_prompts").select("content").eq("tenant_id", tenant.id).eq("is_default", true).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("knowledge_base").select("question, answer").eq("tenant_id", tenant.id).eq("is_active", true).limit(50).then((r) => r.data ?? []),
          ]);
          if (!globalCfg?.enabled) return json(503, { error: "AI disabled" });

          const provider = (globalCfg as any).provider as "groq" | "openai" | "anthropic";
          const model = globalCfg.default_model;
          const temperature = Number(tenantCfg?.temperature ?? globalCfg.default_temperature);
          const maxTokens = tenantCfg?.max_tokens ?? globalCfg.default_max_tokens;

          const kbBlock = kb.length
            ? "\n\nBase de conhecimento da empresa:\n" + kb.map((k: any) => `- P: ${k.question}\n  R: ${k.answer}`).join("\n")
            : "";
          const system = [
            globalCfg.master_system_prompt,
            prompt?.content || "",
            kbBlock,
          ].filter(Boolean).join("\n\n");

          const res = await callProvider({
            provider,
            model,
            temperature,
            maxTokens,
            system,
            messages: parsed.data.messages,
          });

          if (!res.ok) return json(res.status, { error: res.error });

          const charge = await chargeAiUsage({
            tenantId: tenant.id,
            model,
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
            endpoint: "/api/public/ai-reply",
          });

          if (!charge.ok) {
            return json(402, {
              error: "INSUFFICIENT_CREDITS",
              message: "Saldo de créditos insuficiente. Compre mais créditos.",
              balance: charge.balance,
              required: charge.required,
            });
          }

          return json(200, {
            reply: res.reply,
            credits_charged: charge.creditsCharged,
            credits_balance: charge.balanceAfter,
          });
        } catch (e) {
          console.error("ai-reply error", e);
          return json(500, { error: (e as Error).message });
        }
      },
    },
  },
});
