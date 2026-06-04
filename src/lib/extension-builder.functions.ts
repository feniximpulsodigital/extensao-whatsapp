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
  version: "1.0.11",
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

  chrome.storage.local.get(["enabled"],(r)=>{
    if(r.enabled===undefined) chrome.storage.local.set({enabled:true});
  });
  chrome.runtime.sendMessage({type:"setActive",value:true});

  const PROCESSED_IDS = new Set();     // dedupe por data-id
  const SEEN_BUBBLES = new WeakSet();  // dedupe DOM
  const HISTORY = new Map();           // chat -> messages[]
  const MAX_AGE_MS = 10 * 60 * 1000;
  const BTN_ID = "argos-toggle-btn";
  const IDLE_REQUIRED_MS = 3000;

  let busy = false;
  let bgBusy = false;
  let lastUserActivity = Date.now();
  let statusOverrideText = null;
  let statusOverrideOk = true;
  let statusOverrideUntil = 0;

  ["mousemove","mousedown","keydown","wheel","touchstart","focusin"].forEach((ev)=>{
    try{ window.addEventListener(ev, ()=>{ lastUserActivity = Date.now(); }, { passive:true, capture:true }); }catch(_e){}
  });
  function isUserIdle(){ return Date.now() - lastUserActivity >= IDLE_REQUIRED_MS; }
  function isUserComposing(){
    const el = document.activeElement;
    if(!el) return false;
    const tag = (el.tagName||"").toLowerCase();
    if(tag==="input"||tag==="textarea") return true;
    if(el.getAttribute && el.getAttribute("contenteditable")==="true") return true;
    return false;
  }
  function isUserTyping(){
    const box = findInputBox();
    return !!(box && (box.innerText || box.textContent || '').trim().length > 0);
  }

  function setButtonStatus(text, ok, ms){
    statusOverrideText = text;
    statusOverrideOk = ok;
    statusOverrideUntil = Date.now() + (ms || 6000);
    const btn = document.getElementById(BTN_ID);
    if(!btn) return;
    btn.textContent = text;
    btn.style.background = ok ? "#16a34a" : "#dc2626";
  }

  function getEnabled(){
    return new Promise((res)=>chrome.storage.local.get(["enabled"],(r)=>res(r.enabled!==false)));
  }
  function chatKey(chat){ return "chat:"+chat; }
  function getChatEnabled(chat){
    return new Promise((res)=>chrome.storage.local.get([chatKey(chat)],(r)=>{
      res(r[chatKey(chat)] !== false);
    }));
  }
  function setChatEnabled(chat, val){
    return new Promise((res)=>chrome.storage.local.set({[chatKey(chat)]: !!val}, ()=>res()));
  }

  function getChatId(){
    const header = document.querySelector('#main header');
    if(!header) return null;
    return header.innerText?.split("\\n")[0]?.trim() || null;
  }

  // ---------- Detecção de grupo ----------
  function isGroupChat(){
    const header = document.querySelector('#main header');
    if(!header) return false;
    if(header.querySelector('span[data-icon*="group"], span[data-icon*="default-group"]')) return true;
    const spans = header.querySelectorAll('span');
    const subtitleText = (spans[1]?.innerText || '').toLowerCase();
    if(subtitleText.includes('participante') || subtitleText.includes('participant')) return true;
    const senderNames = document.querySelectorAll('#main [data-pre-plain-text]');
    const names = new Set();
    senderNames.forEach((el)=>{
      const pre = el.getAttribute('data-pre-plain-text') || '';
      const match = pre.match(/\\] (.+):$/);
      if(match) names.add(match[1].trim());
    });
    if(names.size > 1) return true;
    return false;
  }

  // ---------- Seletor de mensagens recebidas ----------
  function incomingSelector(){
    return '#main [data-id]';
  }
  function isIncomingBubble(el){
    if(!el) return false;

    // 1. data-id prefix (quando disponível)
    const id = el.getAttribute('data-id') || '';
    if(id.startsWith('true_')) return false;
    if(id.startsWith('false_')) return true;

    // 2. tail-in = recebida, tail-out = enviada (método mais confiável)
    if(el.querySelector('span[data-icon="tail-in"]')) return true;
    if(el.querySelector('span[data-icon="tail-out"]')) return false;

    // 3. Ícone de status de envio = enviada por mim
    if(el.querySelector('span[data-icon*="msg-check"], span[data-icon*="msg-dblcheck"], span[data-icon*="msg-time"]')){
      return false;
    }

    // 4. Mensagem encaminhada recebida
    if(el.querySelector('span[data-icon="forward-refreshed"]')) return true;

    // 5. Sem identificação clara: assume enviada (evita loop de respostas)
    return false;
  }
  function getIncomingBubbles(root){
    const r = root || document;
    return Array.from(r.querySelectorAll(incomingSelector()))
      .map((el)=> el.closest('[data-id]') || el)
      .filter(Boolean)
      .filter((el, idx, arr)=>arr.indexOf(el) === idx)
      .filter(isIncomingBubble);
  }

  // ---------- Timestamps ----------
  function parseWaTimeToTodayMinutes(raw){
    const m = (raw||"").trim().match(/([0-9]{1,2}):([0-9]{2})/);
    if(!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    if(!Number.isFinite(h)||!Number.isFinite(min)) return null;
    return h*60+min;
  }
  function getBubbleTimestampMs(bubble){
    const pre = bubble.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text')
              || bubble.getAttribute('data-pre-plain-text') || "";
    const fromPre = parseWaTimeToTodayMinutes(pre);
    const fromText = fromPre ?? parseWaTimeToTodayMinutes(bubble.innerText||"");
    if(fromText==null) return Date.now();
    const now = new Date();
    const msg = new Date(now);
    msg.setHours(Math.floor(fromText/60), fromText%60, 0, 0);
    if(msg.getTime() - now.getTime() > 60*60*1000) msg.setDate(msg.getDate()-1);
    return msg.getTime();
  }
  function isRecent(bubble){ return Date.now() - getBubbleTimestampMs(bubble) <= MAX_AGE_MS; }

  // ---------- Extração de texto ----------
  function extractText(bubble){
    let pieces = [];
    const pre = bubble.querySelector('[data-pre-plain-text]');
    if(pre){
      pre.querySelectorAll('span[class*="selectable-text"]').forEach((s)=>{
        const t = (s.innerText||s.textContent||"").trim();
        if(t) pieces.push(t);
      });
    }
    if(!pieces.length){
      bubble.querySelectorAll('span[class*="selectable-text"]').forEach((s)=>{
        const t = (s.innerText||s.textContent||"").trim();
        if(t) pieces.push(t);
      });
    }
    let raw = pieces.join("\\n");
    if(!raw) raw = bubble.innerText || "";
    return raw.split("\\n")
      .map((t)=>t.trim())
      .filter(Boolean)
      .filter((t)=>!/^[0-9]{1,2}:[0-9]{2}$/.test(t))
      .join("\\n").trim();
  }

  // ---------- Marcar histórico como visto ao abrir chat ----------
  function markExistingAsSeen(){
    // Marca TODAS as mensagens atualmente visíveis (recentes ou não)
    // para não responder histórico ao abrir uma conversa.
    getIncomingBubbles(document).forEach((b)=>{
      SEEN_BUBBLES.add(b);
      const id = b.getAttribute("data-id");
      if(id) PROCESSED_IDS.add(id);
    });
  }

  // ---------- Caixa de envio ----------
  function findInputBox(){
    const footer = document.querySelector('#main footer') || document.querySelector('footer');
    const boxes = Array.from((footer||document).querySelectorAll('div[contenteditable="true"], [role="textbox"][contenteditable="true"]'));
    return boxes.find((el)=>!el.closest('[aria-hidden="true"]') && !el.getAttribute('aria-label')?.toLowerCase().includes('pesquisar'))
        || document.querySelector('#main footer div[contenteditable="true"]')
        || document.querySelector('div[contenteditable="true"][data-lexical-editor="true"]');
  }
  function findSendButton(){
    const byLabel = Array.from(document.querySelectorAll('button[aria-label]')).find((b)=>{
      const label = (b.getAttribute('aria-label')||'').toLowerCase();
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
    if(!box){warn("caixa não encontrada"); return false;}
    box.focus(); box.click();
    // 1) ClipboardEvent paste
    try{
      const data = new DataTransfer();
      data.setData("text/plain", text);
      box.dispatchEvent(new ClipboardEvent("paste",{clipboardData:data,bubbles:true,cancelable:true}));
    }catch(_e){}
    // 2) execCommand
    if(!box.innerText?.includes(text)){
      try{ document.execCommand("insertText", false, text); }catch(_e){}
    }
    // 3) clipboard + Ctrl+V
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
    if(btn){btn.click(); log("enviado"); return true;}
    box.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,which:13,bubbles:true}));
    return true;
  }

  // ---------- Chamada à IA ----------
  async function askAI(messages){
    try{
      log("IA <-", messages.length, "msgs");
      const r = await fetch(CFG.endpoint, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":CFG.apiKey},
        body: JSON.stringify({ messages }),
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){warn("API erro", r.status, j); setButtonStatus("⚠️ " + (j.error||r.status), false); return null;}
      log("IA ->", j.reply);
      return j.reply || null;
    }catch(e){warn("fetch erro", e); setButtonStatus("⚠️ SEM API", false); return null;}
  }

  // ---------- Processa uma bubble (chat já aberto) ----------
  async function processBubble(bubble, chat){
    if(SEEN_BUBBLES.has(bubble)) return false;
    SEEN_BUBBLES.add(bubble);
    if(!isRecent(bubble)){ return false; }
    const id = bubble.getAttribute("data-id");
    if(id){
      if(PROCESSED_IDS.has(id)) return false;
      PROCESSED_IDS.add(id);
    }
    const text = extractText(bubble);
    if(!text) return false;
    if(!(await getEnabled())){log("global off"); return false;}
    if(isGroupChat()){log("grupo ignorado:", chat); return false;}
    if(chat && !(await getChatEnabled(chat))){log("chat off:", chat); return false;}

    const hist = HISTORY.get(chat) || [];
    hist.push({role:"user", content:text});
    while(hist.length>20) hist.shift();
    HISTORY.set(chat, hist);

    setButtonStatus("🤖 LENDO...", true, 4000);
    const reply = await askAI(hist);
    if(!reply) return false;
    hist.push({role:"assistant", content:reply});
    HISTORY.set(chat, hist);
    setButtonStatus("🤖 ENVIANDO...", true, 4000);
    await new Promise(r=>setTimeout(r, 700 + Math.random()*1000));
    const sent = await sendReply(reply);
    setButtonStatus(sent ? "🤖 RESPONDIDO" : "⚠️ NÃO ENVIOU", sent, 6000);
    return sent;
  }

  // ---------- Scan do chat atualmente aberto (apenas dedupe; NÃO responde sozinho) ----------
  // O fluxo principal de resposta é o background queue. Aqui só registramos IDs vistos
  // para evitar reprocessar quando o background abrir o mesmo chat.
  function trackOpenChatBubbles(){
    getIncomingBubbles(document).forEach((b)=>{
      const id = b.getAttribute("data-id");
      if(id) {
        // não marca como processado — apenas garante existência no SEEN para evitar loops
      }
    });
  }

  // ---------- Sidebar / unread detection ----------
  function getSidebarRows(){
    return Array.from(document.querySelectorAll('#pane-side [role="listitem"]'));
  }
  function findUnreadChatRows(){
    return getSidebarRows().filter((row)=>{
      const badges = row.querySelectorAll('span[aria-label]');
      for(const b of badges){
        const l = (b.getAttribute('aria-label')||'').toLowerCase();
        if(/\\d/.test(l) && /(não lida|nao lida|unread)/.test(l)) return true;
      }
      return false;
    });
  }
  function getSelectedRow(){
    return getSidebarRows().find((r)=> r.querySelector('[aria-selected="true"]') || r.getAttribute('aria-selected')==='true') || null;
  }
  function rowKey(row){
    if(!row) return null;
    return (row.innerText||"").split("\\n")[0].trim() || null;
  }
  function findRowByKey(key){
    if(!key) return null;
    return getSidebarRows().find((r)=> rowKey(r)===key) || null;
  }
  function clickRow(row){
    if(!row) return;
    const target = row.querySelector('[role="button"], [tabindex]') || row;
    target.click();
  }
  async function waitFor(pred, ms){
    const start = Date.now();
    while(Date.now()-start < (ms||4000)){
      try{ if(pred()) return true; }catch(_e){}
      await new Promise(r=>setTimeout(r,120));
    }
    return false;
  }

  // ---------- Background queue ----------
  async function processOneUnread(){
    if(bgBusy || busy) return false;
    if(!(await getEnabled())) return false;
    if(!isUserIdle() || isUserComposing() || isUserTyping()) return false;

    const rows = findUnreadChatRows();
    if(!rows.length) return false;

    bgBusy = true;
    busy = true;
    const prevRow = getSelectedRow();
    const prevKey = rowKey(prevRow);
    const sidebar = document.querySelector('#pane-side [role="grid"]') || document.querySelector('#pane-side');
    const prevScroll = sidebar ? sidebar.scrollTop : 0;
    const beforeChat = getChatId();

    try{
      const row = rows[0];
      clickRow(row);
      await waitFor(()=>{ const c = getChatId(); return c && c !== beforeChat; }, 4000);
      await new Promise(r=>setTimeout(r, 500));

      const chat = getChatId();
      if(chat){
        if(isGroupChat()){
          log("grupo ignorado na sidebar:", chat);
          if(prevKey){
            const back = findRowByKey(prevKey) || getSidebarRows().find((r)=>(r.innerText||'').includes(prevKey));
            if(back){ clickRow(back); await new Promise(r=>setTimeout(r, 300)); }
          }
          if(sidebar){ try{ sidebar.scrollTop = prevScroll; }catch(_e){} }
          return false;
        }
        // só reseta history se chat mudou (não temos history para chats novos)
        if(!HISTORY.has(chat)) HISTORY.set(chat, []);

        // pega APENAS a última recebida recente do chat
        const bubbles = getIncomingBubbles(document).filter(isRecent);
        const last = bubbles[bubbles.length-1];
        if(last) await processBubble(last, chat);
      }

      // Voltar para o chat anterior
      if(prevKey && prevKey !== rowKey(getSelectedRow())){
        const back = findRowByKey(prevKey) || getSidebarRows().find((r)=>(r.innerText||'').includes(prevKey));
        if(back){ clickRow(back); await new Promise(r=>setTimeout(r, 300)); }
      }
      if(sidebar){ try{ sidebar.scrollTop = prevScroll; }catch(_e){} }
      return true;
    }catch(e){ warn("BG erro", e); return false; }
    finally{ bgBusy = false; busy = false; }
  }

  // ---------- Botão ON/OFF por contato ----------
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
    document.querySelectorAll("."+BTN_ID).forEach((el)=>{ if(!header.contains(el)) el.remove(); });
    const existing = header.querySelectorAll("."+BTN_ID);
    for(let i=1;i<existing.length;i++) existing[i].remove();
    let btn = header.querySelector("."+BTN_ID);
    const on = await getChatEnabled(chat);
    if(!btn){
      btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.className = BTN_ID;
      btn.title = "Liga/desliga IA para este contato";
      const target = header.querySelector('div[role="button"]')?.parentElement || header;
      target.insertBefore(btn, target.firstChild);
      btn.addEventListener("click", async ()=>{
        const c = getChatId(); if(!c) return;
        const cur = await getChatEnabled(c);
        await setChatEnabled(c, !cur);
        styleBtn(btn, !cur);
      });
    }
    styleBtn(btn, on);
    btn.dataset.chat = chat;
  }

  // ---------- Chat change detection: marca histórico ao abrir ----------
  let lastSeenChat = null;
  function onChatMaybeChanged(){
    const c = getChatId();
    if(c && c !== lastSeenChat){
      lastSeenChat = c;
      // ao abrir/trocar chat, marca tudo que está visível como já visto
      markExistingAsSeen();
      ensureToggleButton();
      log("chat ativo:", c);
    }
  }

  // ---------- Observer em tempo real do chat aberto ----------
  const obs = new MutationObserver((muts)=>{
    if(bgBusy) return;
    for(const m of muts){
      for(const node of m.addedNodes){
        if(!(node instanceof HTMLElement)) continue;
        const candidates = [];
        if(node.matches?.('[data-id]')) candidates.push(node);
        node.querySelectorAll?.('[data-id]').forEach((b)=>candidates.push(b));
        for(const b of candidates){
          const normalized = b.closest('[data-id]') || b;
          if(!isIncomingBubble(normalized)) continue;
          const chat = getChatId();
          if(chat) processBubble(normalized, chat).catch(()=>{});
        }
      }
    }
  });
  function attachObserver(){
    const main = document.querySelector('#main') || document.body;
    obs.disconnect();
    obs.observe(main, { childList:true, subtree:true });
  }

  // ---------- Loops ----------
  setInterval(()=>{ ensureToggleButton(); onChatMaybeChanged(); attachObserver(); }, 1500);
  setInterval(()=>{ processOneUnread().catch((e)=>warn("BG loop", e)); }, 5000);

  // boot
  setTimeout(()=>{ markExistingAsSeen(); ensureToggleButton(); attachObserver(); lastSeenChat = getChatId(); }, 1500);
  log("extensão ativa (modo background). Botão IA aparece no topo de cada conversa.");
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
