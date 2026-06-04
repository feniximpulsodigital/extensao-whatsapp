import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { zipSync, strToU8 } from "fflate";
import { ICON_16_B64, ICON_48_B64, ICON_128_B64 } from "./extension-icons";

// ---------- Extension source files (templates) ----------

const PRODUCTION_ORIGIN = "https://extensaowhatsapp.com.br";

const MANIFEST = (brandName: string, apiOrigin: string) => ({
  manifest_version: 3,
  name: `${brandName} — IA WhatsApp`,
  version: "1.0.5",
  description: `Atendimento automático com IA no WhatsApp Web — ${brandName}.`,
  permissions: ["storage", "activeTab", "clipboardWrite", "tabs"],
  host_permissions: ["https://web.whatsapp.com/*", `${apiOrigin}/*`],
  action: {
    default_popup: "popup.html",
    default_icon: { "16": "icon-16.png", "48": "icon-48.png", "128": "icon-128.png" },
  },
  background: { service_worker: "background.js" },
  icons: { "16": "icon-16.png", "48": "icon-48.png", "128": "icon-128.png" },
  content_scripts: [
    {
      matches: ["https://web.whatsapp.com/*"],
      js: ["config.js", "content.js"],
      run_at: "document_idle",
    },
  ],
});

const CONFIG_JS = (
  apiKey: string,
  endpoint: string,
) => `// AUTO-GERADO — chave exclusiva do seu cliente. NÃO COMPARTILHE.
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
chrome.storage.local.get(["enabled","active"],(r)=>{
  const en = r.enabled!==false; // default ON
  e.checked = en;
  if(r.active){s.textContent="Ativo";s.classList.remove("off")}
});
e.addEventListener("change",()=>chrome.storage.local.set({enabled:e.checked}));
`;

const BACKGROUND_JS = `// Service worker — mantém estado e ouve mensagens do content script.
chrome.runtime.onInstalled.addListener(()=>{
  chrome.storage.local.get(["enabled"],(r)=>{
    if(r.enabled===undefined) chrome.storage.local.set({enabled:true,active:false});
  });
  chrome.tabs.query({url:"https://web.whatsapp.com/*"},(tabs)=>{
    for(const tab of tabs){ if(tab.id) chrome.tabs.reload(tab.id); }
  });
});
chrome.runtime.onMessage.addListener((msg,_s,send)=>{
  if(msg?.type==="setActive"){chrome.storage.local.set({active:!!msg.value});send({ok:true})}
  return true;
});
`;

const CONTENT_JS = `// Conteúdo injetado no WhatsApp Web. Lê mensagens novas e responde via API Argos.
(function(){
  const CFG = window.__ARGOS_CONFIG__ || {};
  const log = (...a)=>console.log("%c[Argos]","color:#16a34a;font-weight:bold", ...a);
  const warn = (...a)=>console.warn("[Argos]", ...a);
  if(!CFG.apiKey || !CFG.endpoint){warn("config ausente");return;}
  log("inicializando. endpoint =", CFG.endpoint);

  // Garante enabled=true por padrão na primeira execução
  chrome.storage.local.get(["enabled"],(r)=>{
    if(r.enabled===undefined) chrome.storage.local.set({enabled:true});
  });
  chrome.runtime.sendMessage({type:"setActive",value:true});

  const SEEN = new WeakSet();        // dedupe por elemento DOM
  const PROCESSED_IDS = new Set();   // dedupe por data-id quando disponível
  let currentChat = null;
  let history = [];
  let busy = false;
  const BTN_ID = "argos-toggle-btn";
  let statusOverrideText = null;
  let statusOverrideOk = true;
  let statusOverrideUntil = 0;
  const RECENT_INCOMING_WINDOW_MS = 10 * 60 * 1000;

  function setButtonStatus(text, ok, ms){
    statusOverrideText = text;
    statusOverrideOk = ok;
    statusOverrideUntil = Date.now() + (ms || 6000);
    const btn = document.getElementById(BTN_ID);
    if(!btn) return;
    btn.textContent = text;
    btn.style.background = ok ? "#16a34a" : "#dc2626";
  }

  async function askAI(messages){
    try{
      log("chamando IA com", messages.length, "mensagens");
      const r = await fetch(CFG.endpoint, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":CFG.apiKey},
        body: JSON.stringify({ messages }),
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){warn("API erro", r.status, j); setButtonStatus("⚠️ " + (j.error || r.status), false); return null;}
      log("IA respondeu:", j.reply);
      return j.reply || null;
    }catch(e){warn("fetch erro", e); setButtonStatus("⚠️ SEM API", false); return null;}
  }

  function getEnabled(){
    return new Promise((res)=>chrome.storage.local.get(["enabled"],(r)=>res(r.enabled!==false)));
  }

  // ---- Estado por contato (lead) ----
  function chatKey(chat){ return "chat:"+chat; }
  function getChatEnabled(chat){
    return new Promise((res)=>chrome.storage.local.get([chatKey(chat)],(r)=>{
      const v = r[chatKey(chat)];
      res(v !== false); // default: ativo
    }));
  }
  function setChatEnabled(chat, val){
    return new Promise((res)=>chrome.storage.local.set({[chatKey(chat)]: !!val}, ()=>res()));
  }

  function findInputBox(){
    // WhatsApp muda seletores com frequência; prioriza sempre a caixa do rodapé do chat ativo.
    const footer = document.querySelector('#main footer') || document.querySelector('footer');
    const boxes = Array.from((footer || document).querySelectorAll('div[contenteditable="true"], [role="textbox"][contenteditable="true"]'));
    return boxes.find((el)=>!el.closest('[aria-hidden="true"]') && !el.getAttribute('aria-label')?.toLowerCase().includes('pesquisar'))
        || document.querySelector('#main footer div[contenteditable="true"]')
        || document.querySelector('div[contenteditable="true"][data-lexical-editor="true"]');
  }

  function findSendButton(){
    const byLabel = Array.from(document.querySelectorAll('button[aria-label]')).find((b)=>{
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      return label.includes('enviar') || label.includes('send');
    });
    return byLabel
        || document.querySelector('button[aria-label="Enviar"]')
        || document.querySelector('button[aria-label="Send"]')
        || document.querySelector('span[data-icon="send"]')?.closest('button')
        || document.querySelector('span[data-icon="wds-ic-send-filled"]')?.closest('button')
        || Array.from(document.querySelectorAll('span[data-icon*="send"]')).map((s)=>s.closest('button')).find(Boolean);
  }

  async function sendReply(text){
    const box = findInputBox();
    if(!box){warn("caixa de texto não encontrada"); return false;}
    box.focus();
    box.click();
    try{
      const data = new DataTransfer();
      data.setData("text/plain", text);
      box.dispatchEvent(new ClipboardEvent("paste", {clipboardData:data,bubbles:true,cancelable:true}));
    }catch(_e){}
    if(!box.innerText?.includes(text)) document.execCommand("insertText", false, text);
    if(!box.innerText?.includes(text)){
      try{
        await navigator.clipboard.writeText(text);
        box.dispatchEvent(new KeyboardEvent("keydown",{key:"v",code:"KeyV",ctrlKey:true,bubbles:true}));
        box.dispatchEvent(new KeyboardEvent("keyup",{key:"v",code:"KeyV",ctrlKey:true,bubbles:true}));
      }catch(_e){}
    }
    box.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:text}));
    let btn = null;
    for(let i=0;i<16;i++){
      await new Promise(r=>setTimeout(r,250));
      btn = findSendButton();
      if(btn) break;
    }
    if(btn){btn.click(); log("enviado via botão"); return true;}
    // fallback: tecla Enter
    box.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,which:13,bubbles:true}));
    log("enviado via Enter (fallback)");
    return true;
  }

  function getChatId(){
    // Cabeçalho do chat ativo
    const header = document.querySelector('#main header');
    if(!header) return null;
    return header.innerText?.split("\\n")[0]?.trim() || null;
  }

  function parseWaTimeToTodayMinutes(raw){
    const text = (raw || "").trim();
    const m = text.match(/([0-9]{1,2}):([0-9]{2})/);
    if(!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if(!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  }

  function getBubbleTimestampMs(bubble){
    const pre = bubble.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || bubble.getAttribute('data-pre-plain-text') || "";
    const fromPre = parseWaTimeToTodayMinutes(pre);
    const fromText = fromPre ?? parseWaTimeToTodayMinutes(bubble.innerText || "");
    if(fromText == null) return Date.now();
    const now = new Date();
    const msg = new Date(now);
    msg.setHours(Math.floor(fromText / 60), fromText % 60, 0, 0);
    if(msg.getTime() - now.getTime() > 60 * 60 * 1000) msg.setDate(msg.getDate() - 1);
    return msg.getTime();
  }

  function isRecentIncoming(bubble){
    return Date.now() - getBubbleTimestampMs(bubble) <= RECENT_INCOMING_WINDOW_MS;
  }

  function incomingSelector(){
    return '#main [data-id^="false_"], #main [data-id*="false_"], #main div.message-in, #main div[class*="message-in"]';
  }

  function normalizeIncomingBubble(el){
    if(!el || !(el instanceof HTMLElement)) return null;
    const byId = el.matches?.('[data-id^="false_"], [data-id*="false_"]') ? el : el.querySelector?.('[data-id^="false_"], [data-id*="false_"]');
    if(byId) return byId.closest('[data-id]') || byId;
    if(el.matches?.('div.message-in, div[class*="message-in"]')) return el;
    return el.querySelector?.('div.message-in, div[class*="message-in"]') || null;
  }

  function getIncomingBubbles(root){
    return Array.from((root||document).querySelectorAll(incomingSelector()))
      .map(normalizeIncomingBubble)
      .filter(Boolean)
      .filter((el, idx, arr)=>arr.indexOf(el) === idx);
  }

  function extractText(bubble){
    // Texto principal da mensagem
    const nodes = Array.from(bubble.querySelectorAll('span[class*="selectable-text"], span.selectable-text, span._ao3e, [dir="ltr"], [dir="auto"]'));
    const pieces = nodes.map((el)=>el.innerText || el.textContent || "")
      .map((t)=>t.trim())
      .filter(Boolean)
      .filter((t)=>!/^[0-9]{1,2}:[0-9]{2}$/.test(t));
    const raw = pieces.length ? pieces.join("\\n") : (bubble.innerText || "");
    return raw.split("\\n").map((t)=>t.trim()).filter(Boolean).filter((t)=>!/^[0-9]{1,2}:[0-9]{2}$/.test(t)).join("\\n").trim();
  }

  async function processIncoming(bubble){
    if(SEEN.has(bubble)) return;
    SEEN.add(bubble);

    if(!isRecentIncoming(bubble)){log("mensagem antiga ignorada"); return;}

    const dataId = bubble.getAttribute("data-id") || bubble.closest("[data-id]")?.getAttribute("data-id");
    if(dataId){
      if(PROCESSED_IDS.has(dataId)) return;
      PROCESSED_IDS.add(dataId);
    }

    const text = extractText(bubble);
    if(!text){return;}

    if(!(await getEnabled())){log("desativado (global), ignorando:", text); return;}
    const chatNow = getChatId();
    if(chatNow && !(await getChatEnabled(chatNow))){log("desativado para este contato:", chatNow); return;}
    if(busy){log("ocupado, ignorando:", text); return;}

    // Reseta histórico se mudou de conversa
    const chat = getChatId();
    if(chat !== currentChat){currentChat = chat; history = []; log("novo chat:", chat);}

    log("nova mensagem recebida:", text);
    setButtonStatus("🤖 LENDO...", true, 4000);
    busy = true;
    try{
      history.push({role:"user", content:text});
      if(history.length>20) history = history.slice(-20);
      const reply = await askAI(history);
      if(reply){
        history.push({role:"assistant", content:reply});
        setButtonStatus("🤖 ENVIANDO...", true, 4000);
        await new Promise(r=>setTimeout(r, 800 + Math.random()*1200)); // pequeno delay humano
        const sent = await sendReply(reply);
        setButtonStatus(sent ? "🤖 RESPONDIDO" : "⚠️ NÃO ENVIOU", sent, 7000);
      }
    } finally { busy = false; }
  }

  function scanForNewIncoming(root){
    // Pega APENAS a última mensagem recebida visível (não envia respostas a mensagens antigas no scroll)
    const all = getIncomingBubbles(root||document);
    if(!all.length) return;
    const recent = Array.from(all).filter(isRecentIncoming);
    if(!recent.length) return;
    processIncoming(recent[recent.length-1]);
  }

  const obs = new MutationObserver((muts)=>{
    for(const m of muts){
      for(const n of m.addedNodes){
        if(!(n instanceof HTMLElement)) continue;
        const incoming = normalizeIncomingBubble(n);
        if(incoming) { processIncoming(incoming); continue; }
        scanForNewIncoming(n);
      }
    }
  });

  function attach(){
    const main = document.querySelector('#main') || document.body;
    obs.disconnect();
    obs.observe(main, {childList:true, subtree:true});
  }

  // Marca mensagens já existentes como vistas, para não responder histórico antigo ao abrir um chat
  function markExistingAsSeen(){
    getIncomingBubbles(document).forEach(b=>{
      if(isRecentIncoming(b)) return;
      SEEN.add(b);
      const id = b.getAttribute("data-id") || b.closest("[data-id]")?.getAttribute("data-id");
      if(id) PROCESSED_IDS.add(id);
    });
  }

  // ---- Botão "IA: ON/OFF" no cabeçalho do chat ----
  function styleBtn(btn, on){
    const hasOverride = statusOverrideText && Date.now() < statusOverrideUntil;
    btn.textContent = hasOverride ? statusOverrideText : (on ? "🤖 IA: ON" : "🤖 IA: OFF");
    btn.style.background = hasOverride ? (statusOverrideOk ? "#16a34a" : "#dc2626") : (on ? "#16a34a" : "#dc2626");
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.padding = "6px 12px";
    btn.style.borderRadius = "999px";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "600";
    btn.style.cursor = "pointer";
    btn.style.marginRight = "8px";
    btn.style.boxShadow = "0 2px 6px rgba(0,0,0,.15)";
  }
  async function ensureToggleButton(){
    const header = document.querySelector('#main header');
    if(!header) return;
    const chat = getChatId();
    if(!chat) return;

    // Remove botões duplicados (fora do header atual ou repetidos)
    document.querySelectorAll("."+BTN_ID).forEach((el)=>{
      if(!header.contains(el)) el.remove();
    });
    const existing = header.querySelectorAll("."+BTN_ID);
    for(let i=1;i<existing.length;i++) existing[i].remove();

    let btn = header.querySelector("."+BTN_ID);
    const on = await getChatEnabled(chat);

    if(!btn){
      btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.className = BTN_ID;
      btn.title = "Liga/desliga a IA para este contato";
      const target = header.querySelector('div[role="button"]')?.parentElement || header;
      target.insertBefore(btn, target.firstChild);
      btn.addEventListener("click", async ()=>{
        const c = getChatId();
        if(!c) return;
        const cur = await getChatEnabled(c);
        await setChatEnabled(c, !cur);
        styleBtn(btn, !cur);
        log(!cur ? "IA ligada para" : "IA desligada para", c);
      });
    }
    styleBtn(btn, on);
    btn.dataset.chat = chat;
  }

  // ---- Varredura em segundo plano da lista lateral ----
  // Procura conversas com badge de mensagens não lidas, abre cada uma,
  // responde, e volta para o chat que estava aberto.
  let bgBusy = false;

  function findUnreadChatRows(){
    const list = document.querySelector('#pane-side [role="grid"], #pane-side [aria-label]') || document.querySelector('#pane-side');
    if(!list) return [];
    const rows = Array.from(list.querySelectorAll('[role="listitem"], div[role="row"], [data-testid="cell-frame-container"]'));
    const candidates = rows.length ? rows : Array.from(list.querySelectorAll('div')).filter((d)=>d.querySelector('span[aria-label]'));
    return candidates.filter((row)=>{
      const badges = row.querySelectorAll('span[aria-label]');
      for(const b of badges){
        const l = (b.getAttribute('aria-label') || '').toLowerCase();
        if(/^\\s*\\d+\\s*(não lidas|nao lidas|unread|mensagens? não lidas|mensagens? nao lidas)/.test(l)) return true;
        if(/(não lida|nao lida|unread)/.test(l) && /\\d/.test(l)) return true;
      }
      return false;
    });
  }

  function clickRow(row){
    const clickable = row.querySelector('[role="button"], [tabindex]') || row;
    clickable.click();
  }

  async function waitFor(predicate, timeoutMs){
    const start = Date.now();
    while(Date.now() - start < (timeoutMs || 4000)){
      try{ if(predicate()) return true; }catch(_e){}
      await new Promise(r=>setTimeout(r, 150));
    }
    return false;
  }

  async function processOneUnread(){
    if(bgBusy || busy) return false;
    if(!(await getEnabled())) return false;
    const rows = findUnreadChatRows();
    if(!rows.length) return false;

    bgBusy = true;
    const previousChat = getChatId();
    try{
      const row = rows[0];
      const before = getChatId();
      clickRow(row);
      await waitFor(()=>{ const c = getChatId(); return c && c !== before; }, 4000);
      await new Promise(r=>setTimeout(r, 600)); // deixa as bolhas renderizarem

      const chat = getChatId();
      if(chat && !(await getChatEnabled(chat))){ log("BG: chat desativado", chat); return false; }

      // Pega a última mensagem recebida visível
      const bubbles = getIncomingBubbles(document).filter(isRecentIncoming);
      const last = bubbles[bubbles.length-1];
      if(!last){ log("BG: nenhuma mensagem recente"); return false; }

      // Trata como nova conversa: reseta histórico
      currentChat = chat; history = [];
      await processIncoming(last);

      // Volta para a conversa anterior, se havia uma diferente
      if(previousChat && previousChat !== getChatId()){
        const allRows = Array.from(document.querySelectorAll('#pane-side [role="listitem"], #pane-side div[role="row"], #pane-side [data-testid="cell-frame-container"]'));
        const back = allRows.find((r)=>(r.innerText||"").split("\\n")[0].trim() === previousChat);
        if(back){ clickRow(back); }
      }
      return true;
    }catch(e){ warn("BG erro", e); return false; }
    finally{ bgBusy = false; }
  }

  setInterval(()=>{ attach(); ensureToggleButton(); }, 1500);
  setInterval(()=>{ scanForNewIncoming(document); }, 2000);
  setInterval(()=>{ processOneUnread().catch((e)=>warn("BG loop", e)); }, 4000);
  setInterval(()=>{
    const chat = getChatId();
    if(chat && chat !== currentChat){
      currentChat = chat; history = [];
      markExistingAsSeen();
      ensureToggleButton();
      log("chat ativo:", chat);
    }
  }, 1500);

  attach();
  setTimeout(()=>{ markExistingAsSeen(); ensureToggleButton(); }, 1500);
  setTimeout(()=>{ scanForNewIncoming(document); }, 3500);
  log("extensão ativa. Botão IA aparece no topo de cada conversa.");
})();
`;

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
    const origin = data.origin.includes("lovable") ? PRODUCTION_ORIGIN : data.origin;
    const endpoint = `${origin}/api/public/ai-reply`;

    const safeCompany =
      (tenant.company_name || "cliente")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40) || "cliente";

    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8(JSON.stringify(MANIFEST(brandName, origin), null, 2)),
      "config.js": strToU8(CONFIG_JS(tenant.extension_api_key, endpoint)),
      "content.js": strToU8(CONTENT_JS),
      "background.js": strToU8(BACKGROUND_JS),
      "popup.html": strToU8(POPUP_HTML(brandName)),
      "popup.js": strToU8(POPUP_JS),
      "icon-16.png": b64ToU8(ICON_16_B64),
      "icon-48.png": b64ToU8(ICON_48_B64),
      "icon-128.png": b64ToU8(ICON_128_B64),
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
        ].join("\n"),
      ),
    };

    const zipped = zipSync(files, { level: 6 });

    return {
      filename: `${brandName.toLowerCase()}-${safeCompany}.zip`,
      base64: u8ToB64(zipped),
    };
  });
