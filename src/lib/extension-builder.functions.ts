import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { zipSync, strToU8 } from "fflate";

// ---------- Extension source files (templates) ----------

const MANIFEST = (brandName: string) => ({
  manifest_version: 3,
  name: `${brandName} — IA WhatsApp`,
  version: "1.0.0",
  description: `Atendimento automático com IA no WhatsApp Web — ${brandName}.`,
  permissions: ["storage", "activeTab"],
  host_permissions: ["https://web.whatsapp.com/*"],
  action: { default_popup: "popup.html", default_icon: "icon.png" },
  background: { service_worker: "background.js" },
  icons: { "16": "icon.png", "48": "icon.png", "128": "icon.png" },
  content_scripts: [
    {
      matches: ["https://web.whatsapp.com/*"],
      js: ["config.js", "content.js"],
      run_at: "document_idle",
    },
  ],
});

const CONFIG_JS = (apiKey: string, endpoint: string) => `// AUTO-GERADO — chave exclusiva do seu cliente. NÃO COMPARTILHE.
window.__ARGOS_CONFIG__ = {
  apiKey: ${JSON.stringify(apiKey)},
  endpoint: ${JSON.stringify(endpoint)},
};
`;

const POPUP_HTML = (brandName: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${brandName}</title>
<style>
  body{font-family:system-ui,sans-serif;width:280px;padding:14px;margin:0;background:#0f172a;color:#f1f5f9}
  h1{font-size:15px;margin:0 0 6px}
  p{font-size:12px;margin:0 0 10px;color:#94a3b8}
  .badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#16a34a;color:white;font-size:11px;font-weight:600}
  .off{background:#dc2626}
  label{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:10px;cursor:pointer}
</style></head>
<body>
  <h1>${brandName} IA</h1>
  <p>Abra <b>web.whatsapp.com</b> em qualquer aba para ativar o atendimento.</p>
  <div id="status" class="badge off">Inativo</div>
  <label><input type="checkbox" id="enabled"> Responder automaticamente</label>
  <script src="popup.js"></script>
</body></html>`;

const POPUP_JS = `const s=document.getElementById("status");const e=document.getElementById("enabled");
chrome.storage.local.get(["enabled","active"],(r)=>{e.checked=!!r.enabled;if(r.active){s.textContent="Ativo";s.classList.remove("off")}});
e.addEventListener("change",()=>chrome.storage.local.set({enabled:e.checked}));
`;

const BACKGROUND_JS = `// Service worker — mantém estado e ouve mensagens do content script.
chrome.runtime.onInstalled.addListener(()=>{chrome.storage.local.set({enabled:false,active:false})});
chrome.runtime.onMessage.addListener((msg,_s,send)=>{
  if(msg?.type==="setActive"){chrome.storage.local.set({active:!!msg.value});send({ok:true})}
  return true;
});
`;

const CONTENT_JS = `// Conteúdo injetado no WhatsApp Web. Lê mensagens novas e responde via API Argos.
(function(){
  const CFG = window.__ARGOS_CONFIG__ || {};
  if(!CFG.apiKey || !CFG.endpoint){console.warn("[Argos] config ausente");return;}
  chrome.runtime.sendMessage({type:"setActive",value:true});

  const SEEN = new Set();
  let history = []; // últimas mensagens da conversa atual

  async function askAI(messages){
    try{
      const r = await fetch(CFG.endpoint, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":CFG.apiKey},
        body: JSON.stringify({ messages }),
      });
      const j = await r.json();
      if(!r.ok){console.warn("[Argos]",j);return null;}
      return j.reply || null;
    }catch(e){console.warn("[Argos] erro",e);return null;}
  }

  function getEnabled(){
    return new Promise((res)=>chrome.storage.local.get(["enabled"],(r)=>res(!!r.enabled)));
  }

  async function sendReply(text){
    const box = document.querySelector('div[contenteditable="true"][data-tab="10"]')
              || document.querySelector('footer div[contenteditable="true"]');
    if(!box) return;
    box.focus();
    document.execCommand("insertText", false, text);
    await new Promise(r=>setTimeout(r,300));
    const btn = document.querySelector('button[aria-label="Enviar"], button[data-testid="send"]');
    if(btn) btn.click();
  }

  async function onNewIncoming(text){
    if(!text || SEEN.has(text)) return;
    SEEN.add(text);
    if(!(await getEnabled())) return;
    history.push({role:"user", content:text});
    if(history.length>20) history = history.slice(-20);
    const reply = await askAI(history);
    if(reply){
      history.push({role:"assistant", content:reply});
      await sendReply(reply);
    }
  }

  // Observa novas mensagens no painel atual
  const obs = new MutationObserver(()=>{
    const incoming = document.querySelectorAll('div.message-in span.selectable-text span');
    if(!incoming.length) return;
    const last = incoming[incoming.length-1];
    if(!last) return;
    const txt = (last.textContent||"").trim();
    if(txt) onNewIncoming(txt);
  });

  function attach(){
    const main = document.querySelector('#main') || document.body;
    obs.disconnect();
    obs.observe(main, {childList:true, subtree:true});
  }

  setInterval(attach, 4000);
  attach();
  console.log("[Argos] extensão ativa");
})();
`;

// 1x1 PNG transparente (placeholder mínimo válido — usuário pode trocar depois)
const ICON_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZbQDQwAAAAASUVORK5CYII=";

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function u8ToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

// ---------- Server function ----------

export const buildMyExtension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .select("id, extension_api_key, company_name")
      .eq("owner_id", userId)
      .maybeSingle();
    if (error || !tenant) throw new Error("Tenant não encontrado");

    const { data: brandRow } = await supabaseAdmin
      .from("app_settings")
      .select("brand_name")
      .limit(1)
      .maybeSingle();
    const brandName = brandRow?.brand_name || "Argos";

    // Endpoint público da API de resposta
    const origin = new URL(request.url).origin;
    const endpoint = `${origin}/api/public/ai-reply`;

    const safeCompany = (tenant.company_name || "cliente")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "cliente";

    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8(JSON.stringify(MANIFEST(brandName), null, 2)),
      "config.js": strToU8(CONFIG_JS(tenant.extension_api_key, endpoint)),
      "content.js": strToU8(CONTENT_JS),
      "background.js": strToU8(BACKGROUND_JS),
      "popup.html": strToU8(POPUP_HTML(brandName)),
      "popup.js": strToU8(POPUP_JS),
      "icon.png": b64ToU8(ICON_PNG_B64),
      "README.txt": strToU8(
        [
          `${brandName} — Extensão personalizada`,
          ``,
          `Empresa: ${tenant.company_name}`,
          ``,
          `INSTALAÇÃO:`,
          `1. Descompacte este arquivo.`,
          `2. Abra chrome://extensions no Chrome (ou Edge/Brave).`,
          `3. Ative "Modo do desenvolvedor" no canto superior direito.`,
          `4. Clique em "Carregar sem compactação" e selecione a pasta descompactada.`,
          `5. Abra https://web.whatsapp.com e faça login normalmente.`,
          `6. Clique no ícone da extensão e ative "Responder automaticamente".`,
          ``,
          `A IA só funciona enquanto este computador estiver com o Chrome aberto`,
          `e o WhatsApp Web logado.`,
        ].join("\n")
      ),
    };

    const zipped = zipSync(files, { level: 6 });

    return {
      filename: `${brandName.toLowerCase()}-${safeCompany}.zip`,
      base64: u8ToB64(zipped),
    };
  });
