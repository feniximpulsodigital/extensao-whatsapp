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

export const Route = createFileRoute("/api/public/ai-reply")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const apiKey = request.headers.get("x-api-key") ?? "";
          if (!apiKey || apiKey.length < 16) return json(401, { error: "Missing x-api-key" });

          // Resolve tenant by extension key
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

          // Pull configs in parallel
          const [globalCfg, tenantCfg, prompt, kb] = await Promise.all([
            supabaseAdmin.from("ai_global_config").select("*").limit(1).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("ai_config").select("*").eq("tenant_id", tenant.id).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("system_prompts").select("content").eq("tenant_id", tenant.id).eq("is_default", true).maybeSingle().then((r) => r.data),
            supabaseAdmin.from("knowledge_base").select("question, answer").eq("tenant_id", tenant.id).eq("is_active", true).limit(50).then((r) => r.data ?? []),
          ]);
          if (!globalCfg?.enabled) return json(503, { error: "AI disabled" });

          const model = tenantCfg?.model || globalCfg.default_model;
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

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) return json(500, { error: "Server misconfigured" });

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              temperature,
              max_tokens: maxTokens,
              messages: [{ role: "system", content: system }, ...parsed.data.messages],
            }),
          });

          if (aiRes.status === 429) return json(429, { error: "Limite de uso da IA atingido. Tente novamente em instantes." });
          if (aiRes.status === 402) return json(402, { error: "Créditos da plataforma esgotados. Avise o administrador." });
          if (!aiRes.ok) {
            const txt = await aiRes.text();
            console.error("AI gateway error", aiRes.status, txt);
            return json(502, { error: "AI gateway error" });
          }
          const aiJson: any = await aiRes.json();
          const reply: string = aiJson?.choices?.[0]?.message?.content ?? "";
          const usage = aiJson?.usage ?? {};
          const inputTokens = Number(usage.prompt_tokens ?? 0);
          const outputTokens = Number(usage.completion_tokens ?? 0);

          const charge = await chargeAiUsage({
            tenantId: tenant.id,
            model,
            inputTokens,
            outputTokens,
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
            reply,
            model,
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
