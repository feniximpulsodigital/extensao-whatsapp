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
  sessionId: z.string().max(300).optional(),
  // identifica a mensagem sendo respondida; instâncias em PCs diferentes
  // geram a mesma chave e só a primeira a reivindicar recebe a resposta
  dedupeKey: z.string().max(300).optional(),
});

// claims mais velhos que isso podem ser reivindicados de novo
// (cobre instância que travou entre reivindicar e enviar)
const CLAIM_TTL_MS = 120_000;

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

  async function callLovableGateway() {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, status: 500, error: "Falta o secret LOVABLE_API_KEY" };
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("lovable gateway error", r.status, t);
      return { ok: false as const, status: r.status === 429 ? 429 : 502, error: r.status === 429 ? "Limite de uso atingido" : "Erro no provedor de IA" };
    }
    const j: any = await r.json();
    return {
      ok: true as const,
      reply: j?.choices?.[0]?.message?.content ?? "",
      inputTokens: Number(j?.usage?.prompt_tokens ?? 0),
      outputTokens: Number(j?.usage?.completion_tokens ?? 0),
    };
  }

  if (provider === "groq" || provider === "openai") {
    const key = provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
    if (!key) return callLovableGateway();
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
  if (!key) return callLovableGateway();
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

          // Deduplicação entre instâncias (vários PCs na mesma conta WhatsApp)
          const dedupeKey = parsed.data.dedupeKey;
          if (dedupeKey) {
            const { error: insErr } = await supabaseAdmin
              .from("ai_reply_claims")
              .insert({ tenant_id: tenant.id, claim_key: dedupeKey });
            if (insErr) {
              const { data: claim } = await supabaseAdmin
                .from("ai_reply_claims")
                .select("id, claimed_at")
                .eq("tenant_id", tenant.id)
                .eq("claim_key", dedupeKey)
                .maybeSingle();
              const age = claim ? Date.now() - new Date(claim.claimed_at).getTime() : Infinity;
              if (claim && age < CLAIM_TTL_MS) {
                return json(200, { skip: true, reason: "already-claimed" });
              }
              if (claim) {
                await supabaseAdmin
                  .from("ai_reply_claims")
                  .update({ claimed_at: new Date().toISOString() })
                  .eq("id", claim.id);
              }
            }
            // limpeza oportunista de claims antigos do tenant
            supabaseAdmin
              .from("ai_reply_claims")
              .delete()
              .eq("tenant_id", tenant.id)
              .lt("claimed_at", new Date(Date.now() - 86_400_000).toISOString())
              .then(() => {}, () => {});
          }

          const [globalCfg, tenantCfg, prompt, kb, kbFiles] = await Promise.all([
            supabaseAdmin.from("ai_global_config").select("*").limit(1).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("ai_config").select("*").eq("tenant_id", tenant.id).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("system_prompts").select("content").eq("tenant_id", tenant.id).eq("is_default", true).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("knowledge_base").select("question, answer").eq("tenant_id", tenant.id).eq("is_active", true).limit(50).then((r) => r.data ?? []),
            supabaseAdmin.from("knowledge_files").select("filename, content").eq("tenant_id", tenant.id).eq("is_active", true).order("created_at", { ascending: false }).limit(10).then((r) => r.data ?? []),
          ]);
          if (!globalCfg?.enabled) return json(503, { error: "AI disabled" });

          const provider = (globalCfg as any).provider as "groq" | "openai" | "anthropic";
          const model = globalCfg.default_model;
          const temperature = Number(tenantCfg?.temperature ?? globalCfg.default_temperature);
          // Auto: dimensiona resposta pelo tamanho da última mensagem do usuário (otimiza custo)
          const lastUserMsg = [...parsed.data.messages].reverse().find((m: any) => m.role === "user")?.content ?? "";
          const approxInTokens = Math.ceil(lastUserMsg.length / 4);
          const maxTokens = Math.min(800, Math.max(180, approxInTokens * 2 + 120));

          const kbBlock = kb.length
            ? "\n\nBase de conhecimento da empresa:\n" + kb.map((k: any) => `- P: ${k.question}\n  R: ${k.answer}`).join("\n")
            : "";
          // Documentos enviados pelo cliente: orçamento total para não estourar tokens
          let filesBudget = 9000;
          const fileParts: string[] = [];
          for (const f of kbFiles as { filename: string; content: string }[]) {
            if (filesBudget <= 200) break;
            const slice = (f.content || "").slice(0, Math.min(4000, filesBudget));
            if (!slice) continue;
            fileParts.push(`--- Documento: ${f.filename} ---\n${slice}`);
            filesBudget -= slice.length;
          }
          const filesBlock = fileParts.length
            ? "\n\nDocumentos da empresa (use como fonte ao responder):\n" + fileParts.join("\n\n")
            : "";
          const system = [
            globalCfg.master_system_prompt,
            prompt?.content || "",
            kbBlock,
            filesBlock,
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
