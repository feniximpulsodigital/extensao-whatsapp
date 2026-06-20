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
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
  sessionId: z.string().max(300).optional(),
  // identifica a mensagem sendo respondida; instâncias em PCs diferentes
  // geram a mesma chave e só a primeira a reivindicar recebe a resposta
  dedupeKey: z.string().max(300).optional(),
  // identifica o computador (persistido no chrome.storage) — usado no limite
  // de dispositivos por plano; ausente em extensões antigas (sem enforcement)
  deviceId: z.string().max(80).optional(),
  // número do WhatsApp conectado (dígitos), lido do store pela extensão
  meNumber: z.string().max(32).optional(),
  // áudio da última mensagem do cliente (PTT/voz), para transcrição.
  // base64 ~ até 16MB de áudio → limitamos a ~2.7M chars (≈ 2MB binário).
  audio: z
    .object({
      base64: z.string().max(2_700_000),
      mime: z.string().max(60).optional(),
      seconds: z.number().min(0).max(900).optional(),
    })
    .optional(),
  // tipo da última mensagem do cliente (do store do WhatsApp). Para
  // image/document/video respondemos com o texto fixo cadastrado.
  mediaType: z.string().max(30).optional(),
});

// Whisper (Groq/OpenAI) cobra por segundo de áudio; estimamos tokens a partir
// da duração só para a contabilidade de créditos (~ proxy razoável).
const AUDIO_TOKENS_PER_SECOND = 50;

// claims mais velhos que isso podem ser reivindicados de novo
// (cobre instância que travou entre reivindicar e enviar)
const CLAIM_TTL_MS = 120_000;

// janela deslizante do limite de dispositivos: um PC conta como "ativo"
// enquanto tiver feito alguma chamada nos últimos N minutos
const DEVICE_WINDOW_MS = 10 * 60_000;

function soDigitos(s: string) {
  return s.replace(/\D/g, "");
}

// tolera DDI omitido / 9º dígito: igual ou um termina com o outro (mín. 8 dígitos)
function numerosBatem(a: string, b: string) {
  if (a.length < 8 || b.length < 8) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

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
}): Promise<
  | { ok: true; reply: string; inputTokens: number; outputTokens: number }
  | { ok: false; status: number; error: string }
> {
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
      return {
        ok: false as const,
        status: r.status === 429 ? 429 : 502,
        error: r.status === 429 ? "Limite de uso atingido" : "Erro no provedor de IA",
      };
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
    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error(`${provider} error`, r.status, t);
      return {
        ok: false,
        status: r.status === 429 ? 429 : 502,
        error: r.status === 429 ? "Limite de uso atingido" : "Erro no provedor de IA",
      };
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
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("anthropic error", r.status, t);
    return {
      ok: false,
      status: r.status === 429 ? 429 : 502,
      error: r.status === 429 ? "Limite de uso atingido" : "Erro no provedor de IA",
    };
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

// Transcreve um áudio (PTT) seguindo o provedor configurado pelo admin:
// - groq:   Whisper na API do Groq (whisper-large-v3-turbo)
// - openai: Whisper na API da OpenAI (whisper-1)
// - anthropic (sem API de áudio) ou sem key: cai no gateway Lovable (Gemini),
//   que aceita áudio inline e devolve a transcrição.
async function transcribeAudio(opts: {
  provider: "groq" | "openai" | "anthropic";
  base64: string;
  mime: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { provider, base64, mime } = opts;

  function b64ToBlob() {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || "audio/ogg" });
  }

  async function viaWhisper(url: string, key: string, model: string) {
    const form = new FormData();
    const ext = (mime || "audio/ogg").includes("mp4") ? "m4a" : "ogg";
    form.append("file", b64ToBlob(), `audio.${ext}`);
    form.append("model", model);
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!r.ok) {
      console.error("whisper error", r.status, await r.text());
      return { ok: false as const, error: "Falha ao transcrever o áudio" };
    }
    const j: any = await r.json();
    return { ok: true as const, text: String(j?.text ?? "").trim() };
  }

  async function viaLovableGateway() {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "Transcrição de áudio indisponível" };
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva o áudio a seguir literalmente, em português. Responda apenas com a transcrição, sem comentários.",
              },
              { type: "input_audio", input_audio: { data: base64, format: mime?.includes("mp4") ? "m4a" : "ogg" } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) {
      console.error("gateway transcribe error", r.status, await r.text());
      return { ok: false as const, error: "Falha ao transcrever o áudio" };
    }
    const j: any = await r.json();
    return { ok: true as const, text: String(j?.choices?.[0]?.message?.content ?? "").trim() };
  }

  // Tenta o provedor configurado primeiro; se a key não existir ou falhar,
  // cai para QUALQUER outro provedor de transcrição disponível no ambiente.
  // Assim o áudio é transcrito se houver ao menos uma key (OpenAI/Groq/Lovable),
  // em vez de desistir só porque o provedor "preferido" não está pronto.
  const tentativas: Array<() => Promise<{ ok: true; text: string } | { ok: false; error: string }>> = [];
  const addGroq = () => {
    if (process.env.GROQ_API_KEY)
      tentativas.push(() =>
        viaWhisper(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          process.env.GROQ_API_KEY!,
          "whisper-large-v3-turbo",
        ),
      );
  };
  const addOpenai = () => {
    if (process.env.OPENAI_API_KEY)
      tentativas.push(() =>
        viaWhisper(
          "https://api.openai.com/v1/audio/transcriptions",
          process.env.OPENAI_API_KEY!,
          "whisper-1",
        ),
      );
  };
  const addLovable = () => {
    if (process.env.LOVABLE_API_KEY) tentativas.push(viaLovableGateway);
  };
  // ordem: provedor preferido primeiro
  if (provider === "groq") { addGroq(); addOpenai(); addLovable(); }
  else if (provider === "openai") { addOpenai(); addGroq(); addLovable(); }
  else { addLovable(); addGroq(); addOpenai(); }

  if (tentativas.length === 0) {
    console.error("transcribeAudio: nenhuma key de transcrição configurada (GROQ/OPENAI/LOVABLE)");
    return { ok: false, error: "Transcrição de áudio não configurada no servidor" };
  }

  let ultimoErro = "desconhecido";
  for (const fn of tentativas) {
    try {
      const r = await fn();
      if (r.ok && r.text) return r;
      ultimoErro = r.ok ? "transcrição vazia" : r.error;
    } catch (e) {
      ultimoErro = (e as Error)?.message ?? "exceção";
      console.error("transcribeAudio tentativa falhou:", ultimoErro);
    }
  }
  return { ok: false, error: ultimoErro };
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
            .select("id, status, credits_balance, owner_id, whatsapp_numbers, plans!tenants_plan_id_fkey(max_devices)")
            .eq("extension_api_key", apiKey)
            .maybeSingle();
          if (!tenant) return json(401, { error: "Invalid api key" });
          if (tenant.status !== "active") return json(403, { error: "Tenant inactive" });

          let payload: unknown;
          try {
            payload = await request.json();
          } catch {
            return json(400, { error: "Invalid JSON" });
          }
          const parsed = BodySchema.safeParse(payload);
          if (!parsed.success)
            return json(400, { error: "Invalid body", details: parsed.error.flatten() });

          // ===== Números autorizados (cadastrados no dashboard) =====
          // Só aplica quando a extensão é nova o bastante para se identificar
          // (deviceId presente); extensões antigas seguem como legado.
          if (parsed.data.deviceId) {
            const registrados = (tenant.whatsapp_numbers ?? [])
              .map((n) => soDigitos(n))
              .filter((n) => n.length >= 8);
            if (!registrados.length) {
              return json(403, {
                error: "NUMBER_NOT_SET",
                message: "Cadastre o número do seu WhatsApp no painel da Argos para ativar a IA.",
              });
            }
            const conectado = soDigitos(parsed.data.meNumber ?? "");
            // se a extensão não conseguiu ler o número do store, não dá para
            // verificar — segue (o limite de dispositivos continua valendo)
            if (conectado && !registrados.some((r) => numerosBatem(conectado, r))) {
              return json(403, {
                error: "NUMBER_MISMATCH",
                message:
                  "Este WhatsApp não está entre os números cadastrados no painel. Adicione o número no painel ou conecte o WhatsApp Web de uma conta autorizada.",
              });
            }
          }

          // ===== Limite de computadores (janela deslizante) =====
          if (parsed.data.deviceId) {
            const maxDevices =
              (tenant.plans as { max_devices: number | null } | null)?.max_devices ?? null;
            if (maxDevices && maxDevices > 0) {
              const cutoff = new Date(Date.now() - DEVICE_WINDOW_MS).toISOString();
              const { data: ativos } = await supabaseAdmin
                .from("tenant_devices")
                .select("device_id")
                .eq("tenant_id", tenant.id)
                .gt("last_seen_at", cutoff);
              const lista = ativos ?? [];
              const conhecido = lista.some((d) => d.device_id === parsed.data.deviceId);
              if (!conhecido && lista.length >= maxDevices) {
                // não atualiza last_seen: o PC bloqueado não ocupa a vaga
                return json(403, {
                  error: "DEVICE_LIMIT",
                  message:
                    maxDevices === 1
                      ? "Seu plano permite 1 computador por vez. Feche a extensão no outro PC e aguarde 10 minutos, ou faça upgrade de plano."
                      : `Seu plano permite ${maxDevices} computadores por vez. Desative a extensão em um deles e aguarde 10 minutos, ou faça upgrade de plano.`,
                });
              }
            }
            await supabaseAdmin.from("tenant_devices").upsert(
              {
                tenant_id: tenant.id,
                device_id: parsed.data.deviceId,
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,device_id" },
            );
          }

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
              .then(
                () => {},
                () => {},
              );
          }

          const [globalCfg, tenantCfg, prompt, kb, kbFiles] = await Promise.all([
            supabaseAdmin
              .from("ai_global_config")
              .select("*")
              .limit(1)
              .maybeSingle()
              .then((r) => r.data),
            supabaseAdmin
              .from("ai_config")
              .select("*")
              .eq("tenant_id", tenant.id)
              .maybeSingle()
              .then((r) => r.data),
            supabaseAdmin
              .from("system_prompts")
              .select("content")
              .eq("tenant_id", tenant.id)
              .eq("is_default", true)
              .maybeSingle()
              .then((r) => r.data),
            supabaseAdmin
              .from("knowledge_base")
              .select("question, answer")
              .eq("tenant_id", tenant.id)
              .eq("is_active", true)
              .limit(50)
              .then((r) => r.data ?? []),
            supabaseAdmin
              .from("knowledge_files")
              .select("filename, content")
              .eq("tenant_id", tenant.id)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(10)
              .then((r) => r.data ?? []),
          ]);
          if (!globalCfg?.enabled) return json(503, { error: "AI disabled" });

          const provider = (globalCfg as any).provider as "groq" | "openai" | "anthropic";
          const model = globalCfg.default_model;
          const temperature = Number(tenantCfg?.temperature ?? globalCfg.default_temperature);

          // ===== Mídia que a IA não interpreta (imagem/documento/vídeo) =====
          // Responde o texto fixo cadastrado pelo cliente e sinaliza para a
          // extensão deixar o chat NÃO LIDO (o dono precisa olhar). Não chama
          // IA nem cobra créditos. Áudio NÃO entra aqui (é transcrito abaixo).
          const mt = parsed.data.mediaType;
          if (mt === "image" || mt === "document" || mt === "video") {
            const cfgAny = tenantCfg as any;
            const fixo =
              mt === "image"
                ? cfgAny?.media_reply_image
                : mt === "document"
                  ? cfgAny?.media_reply_document
                  : cfgAny?.media_reply_video;
            const reply = (fixo ?? "").trim();
            // se o cliente apagou o texto, não responde nada — mas ainda marca não-lido
            return json(200, { reply: reply || null, keepUnread: true });
          }

          // ===== Transcrição de áudio (PTT/voz) =====
          // A extensão envia o áudio só quando a última mensagem do cliente é
          // de voz. Transcrevemos com o provedor do admin e substituímos o
          // marcador "[áudio]" pelo texto na última mensagem do usuário.
          const msgs = parsed.data.messages.map((m) => ({ ...m }));
          let audioError: string | null = null;
          if (parsed.data.audio?.base64) {
            const tr = await transcribeAudio({
              provider,
              base64: parsed.data.audio.base64,
              mime: parsed.data.audio.mime ?? "audio/ogg",
            });
            if (!tr.ok) {
              audioError = tr.error;
              console.error("transcrição falhou:", tr.error, "mime:", parsed.data.audio.mime);
            }
            // localiza a última mensagem do cliente para injetar a transcrição
            let lastUserIdx = -1;
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === "user") {
                lastUserIdx = i;
                break;
              }
            }
            if (tr.ok && tr.text && lastUserIdx >= 0) {
              const base = msgs[lastUserIdx].content.replace("[áudio]", "").trim();
              msgs[lastUserIdx].content = base
                ? `${base}\n[áudio transcrito]: ${tr.text}`
                : `[áudio transcrito]: ${tr.text}`;
              // cobra a transcrição pela duração estimada (entrada apenas)
              const secs = Math.max(1, Math.ceil(parsed.data.audio.seconds ?? 0));
              await chargeAiUsage({
                tenantId: tenant.id,
                model: `${provider}/whisper`,
                inputTokens: secs * AUDIO_TOKENS_PER_SECOND,
                outputTokens: 0,
                endpoint: "/api/public/ai-reply#transcribe",
              });
            } else if (lastUserIdx >= 0) {
              // transcrição falhou: instrui a IA a pedir o texto por escrito
              msgs[lastUserIdx].content = msgs[lastUserIdx].content.replace(
                "[áudio]",
                "[o cliente enviou um áudio que não pôde ser transcrito]",
              );
            }
          }
          // Auto: dimensiona resposta pelo tamanho da última mensagem do usuário (otimiza custo)
          const lastUserMsg =
            [...msgs].reverse().find((m: any) => m.role === "user")?.content ?? "";
          const approxInTokens = Math.ceil(lastUserMsg.length / 4);
          const maxTokens = Math.min(800, Math.max(180, approxInTokens * 2 + 120));

          const kbBlock = kb.length
            ? "\n\nBase de conhecimento da empresa:\n" +
              kb.map((k: any) => `- P: ${k.question}\n  R: ${k.answer}`).join("\n")
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
          // Regras de mídia (Opção 0): o cliente lê mensagens não-texto como
          // marcadores [imagem]/[áudio]/[documento]/etc. Sem instrução, a IA
          // responde sem sentido. Áudio já chega transcrito quando possível.
          const mediaRules =
            "Regras para mensagens não textuais:\n" +
            "- [áudio] (sem transcrição): diga gentilmente que por aqui você não consegue ouvir áudios e peça que escrevam a dúvida.\n" +
            "- [imagem], [documento], [vídeo], [figurinha], [localização], [contato]: você não consegue abrir nem ver esse conteúdo. Reconheça o envio, peça os detalhes por escrito e, se for algo que precisa de análise humana (ex.: comprovante de pagamento, foto de problema), avise que um atendente vai verificar. NUNCA confirme pagamento ou dado baseado apenas em uma imagem que você não pode ver.";

          const system = [
            globalCfg.master_system_prompt,
            prompt?.content || "",
            mediaRules,
            kbBlock,
            filesBlock,
          ]
            .filter(Boolean)
            .join("\n\n");

          const res = await callProvider({
            provider,
            model,
            temperature,
            maxTokens,
            system,
            messages: msgs,
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
            audioError: audioError || undefined,
          });
        } catch (e) {
          console.error("ai-reply error", e);
          return json(500, { error: (e as Error).message });
        }
      },
    },
  },
});
