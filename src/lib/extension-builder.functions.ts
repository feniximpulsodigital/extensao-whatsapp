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
  version: "1.0.17",
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
  log("inicializando v1.0.17. endpoint =", CFG.endpoint);

  chrome.storage.local.get(["enabled"],(r)=>{
    if(r.enabled===undefined) chrome.storage.local.set({enabled:true});
  });
  chrome.runtime.sendMessage({type:"setActive",value:true});

  // ============================================================
  // SELETORES EM CASCATA — fáceis de atualizar quando WA muda
  // ============================================================
  const SELETORES_INPUT = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][aria-label="Digite uma mensagem"]',
    'div[contenteditable="true"][aria-label="Type a message"]',
    'footer div[contenteditable="true"][data-lexical-editor="true"]',
    'footer div[contenteditable="true"]',
    '[data-testid="conversation-compose-box-input"]',
  ];
  const SELETORES_ENVIAR = [
    'button[aria-label="Enviar"]',
    'button[aria-label="Send"]',
    '[data-testid="send"]',
    'span[data-icon="send"]',
    'span[data-icon="wds-ic-send-filled"]',
  ];
  const SELETORES_HEADER = [
    'header [data-testid="conversation-info-header"] span[title]',
    '#main header span[title][dir="auto"]',
    '#main header span[dir="auto"]',
  ];

  function buscarElemento(lista){
    for(const sel of lista){
      const el = document.querySelector(sel);
      if(el){
        if(el.tagName === "SPAN" && el.getAttribute("data-icon")){
          const btn = el.closest("button");
          if(btn) return btn;
        }
        return el;
      }
    }
    return null;
  }
  function esperar(ms){ return new Promise(r=>setTimeout(r, ms)); }

  // ============================================================
  // ESTADO
  // ============================================================
  const BTN_ID = "argos-toggle-btn";
  const DEBOUNCE_MS = 3000;
  const chatsEmProcessamento = new Set();
  const debounceTimers = new Map(); // chat -> timer id
  let statusOverrideText = null;
  let statusOverrideOk = true;
  let statusOverrideUntil = 0;
  let lastSeenChat = null;

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

  // ============================================================
  // IDENTIFICAÇÃO DE CHAT / GRUPO / USUÁRIO DIGITANDO
  // ============================================================
  function ehTextoDeStatus(t){
    if(!t) return true;
    const tl = t.toLowerCase();
    const padroes = [
      'online','offline','digitando','typing','gravando','recording',
      'visto por último','visto por ultimo','last seen','visto hoje','visto ontem',
      'clique para mostrar','click here for','dados do contato','contact info'
    ];
    return padroes.some(p=>tl.includes(p));
  }
  function getChatId(){
    // MÉTODO 1: item selecionado na sidebar
    const ativo = document.querySelector('#pane-side [aria-selected="true"]');
    if(ativo){
      const nome = ativo.querySelector('span[title]')?.getAttribute('title')?.trim();
      if(nome && !ehTextoDeStatus(nome)) return nome;
    }
    // MÉTODO 2: header — primeiro span que NÃO é status
    const header = document.querySelector('#main header');
    if(!header) return null;
    const spans = header.querySelectorAll('span[title], span[dir="auto"]');
    for(const s of spans){
      const t = (s.getAttribute('title') || s.innerText || '').trim();
      if(t && !ehTextoDeStatus(t)) return t;
    }
    return null;
  }
  function nomesIguais(a, b){
    if(!a || !b) return false;
    const norm = (s)=>s.replace(/[\\s\\-\\(\\)\\+\\u2011\\u2013]/g,'').toLowerCase();
    const na = norm(a), nb = norm(b);
    return na === nb || na.includes(nb) || nb.includes(na);
  }
  function simularCliqueReal(elemento){
    const rect = elemento.getBoundingClientRect();
    const x = rect.left + rect.width/2;
    const y = rect.top + rect.height/2;
    const opts = { bubbles:true, cancelable:true, view:window, clientX:x, clientY:y, button:0 };
    elemento.dispatchEvent(new MouseEvent('mousedown', opts));
    elemento.dispatchEvent(new MouseEvent('mouseup', opts));
    elemento.dispatchEvent(new MouseEvent('click', opts));
  }
  async function abrirChat(chat){
    const alvos = [
      chat.item.querySelector('div[tabindex]'),
      chat.item.querySelector('div[role="button"]'),
      chat.item.firstElementChild,
      chat.item,
    ].filter(Boolean);
    for(const alvo of alvos){
      simularCliqueReal(alvo);
      await esperar(1200);
      const atual = getChatId();
      if(nomesIguais(atual, chat.nome)){
        log("chat aberto com sucesso:", atual);
        return true;
      }
      log("tentativa falhou alvo", alvo.tagName, "- atual:", atual);
    }
    warn("não foi possível abrir o chat:", chat.nome);
    return false;
  }
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
  function isUserTyping(){
    const box = buscarElemento(SELETORES_INPUT);
    return !!(box && (box.innerText || box.textContent || '').trim().length > 0);
  }

  // ============================================================
  // LEITURA DE MENSAGENS — usa [role="row"] + data-id (false_/true_)
  // ============================================================
  function getAreaMensagens(){
    return document.querySelector('#main div[role="application"]')
      || document.querySelector('#main .copyable-area')
      || document.querySelector('#main');
  }
  function detectarRoleRow(row){
    // MÉTODO 1: data-id ("false_..." = recebida, "true_..." = enviada)
    const elComId = row.hasAttribute('data-id') ? row : row.querySelector('[data-id]');
    if(elComId){
      const id = elComId.getAttribute('data-id') || '';
      if(id.startsWith('false_')) return 'user';
      if(id.startsWith('true_')) return 'assistant';
    }
    // MÉTODO 2: classes antigas
    if(row.querySelector('.message-in')) return 'user';
    if(row.querySelector('.message-out')) return 'assistant';
    // MÉTODO 3: alinhamento horizontal da bolha
    const bolha = row.firstElementChild;
    if(bolha){
      const rRow = row.getBoundingClientRect();
      const rBolha = bolha.getBoundingClientRect();
      if(rRow.width > 0 && rBolha.width > 0 && rBolha.width < rRow.width * 0.9){
        const centroRow = rRow.left + rRow.width/2;
        const centroBolha = rBolha.left + rBolha.width/2;
        return centroBolha < centroRow ? 'user' : 'assistant';
      }
    }
    return null;
  }
  function lerMensagens(limite){
    const max = limite || 20;
    const out = [];
    const area = getAreaMensagens();
    if(!area) return out;
    const rows = area.querySelectorAll('[role="row"]');
    rows.forEach((row)=>{
      if(row.closest('header')) return;
      const role = detectarRoleRow(row);
      if(!role) return;
      let texto = "";
      const spans = row.querySelectorAll('span.selectable-text, span[class*="selectable-text"]');
      spans.forEach((s)=>{
        const t = (s.innerText || s.textContent || "").trim();
        if(t) texto += (texto ? "\\n" : "") + t;
      });
      if(!texto){
        const raw = (row.innerText || "").trim();
        texto = raw.split("\\n").filter((t)=>!/^[0-9]{1,2}:[0-9]{2}$/.test(t.trim())).join("\\n").trim();
      }
      if(!texto) return;
      out.push({ role: role, content: texto });
    });
    return out.slice(-max);
  }

  // ============================================================
  // INSERÇÃO DE TEXTO + ENVIO (Lexical-friendly)
  // ============================================================
  async function inserirTexto(campo, texto){
    campo.focus();
    campo.click();
    try{
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    }catch(_e){}
    document.execCommand('insertText', false, texto);
    campo.dispatchEvent(new InputEvent('input', {
      bubbles:true, cancelable:true, inputType:'insertText', data:texto
    }));
  }
  async function enviarMensagem(campo){
    await esperar(300);
    const botao = buscarElemento(SELETORES_ENVIAR);
    if(botao){
      botao.click();
      return true;
    }
    campo.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true }));
    campo.dispatchEvent(new KeyboardEvent('keyup',   { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true }));
    return true;
  }

  // ============================================================
  // CHAMADA À IA
  // ============================================================
  async function askAI(messages, sessionId){
    try{
      log("IA <-", messages.length, "msgs (session:", sessionId, ")");
      const r = await fetch(CFG.endpoint, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":CFG.apiKey},
        body: JSON.stringify({ messages, sessionId }),
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){ warn("API erro", r.status, j); setButtonStatus("⚠️ "+(j.error||r.status), false); return null; }
      log("IA ->", j.reply);
      return j.reply || null;
    }catch(e){ warn("fetch erro", e); setButtonStatus("⚠️ SEM API", false); return null; }
  }

  // ============================================================
  // PROCESSAMENTO PRINCIPAL (após debounce)
  // ============================================================
  async function processarChat(chat){
    if(chatsEmProcessamento.has(chat)) return;
    chatsEmProcessamento.add(chat);
    try{
      if(!(await getEnabled())){ log("global off"); return; }
      if(!nomesIguais(getChatId(), chat)){ log("chat mudou durante debounce"); return; }
      if(isGroupChat()){ log("grupo ignorado:", chat); return; }
      if(!(await getChatEnabled(chat))){ log("chat off:", chat); return; }
      if(isUserTyping()){ log("usuário digitando, abortando"); return; }

      const mensagens = lerMensagens(20);
      log("total de mensagens lidas:", mensagens.length, "chat:", chat);
      if(!mensagens.length){ warn("nenhuma mensagem lida — verificar seletores da área de mensagens"); return; }
      const ultima = mensagens[mensagens.length-1];
      log("ultima eh do contato?", ultima.role === "user", "| texto:", ultima.content.slice(0,60));
      if(ultima.role !== "user"){ log("última é nossa, não responder"); return; }

      setButtonStatus("🤖 LENDO...", true, 4000);
      const sessionId = CFG.apiKey + ":" + chat;
      const reply = await askAI(mensagens, sessionId);
      if(!reply) return;

      // delay humanizado 1.5s - 4s
      const delay = 1500 + Math.random() * 2500;
      setButtonStatus("🤖 DIGITANDO...", true, Math.ceil(delay)+1500);
      await esperar(delay);

      if(isUserTyping()){ log("usuário começou a digitar, cancelando envio"); return; }
      if(!nomesIguais(getChatId(), chat)){ log("chat mudou antes de enviar"); return; }

      const campo = buscarElemento(SELETORES_INPUT);
      if(!campo){ warn("caixa de envio não encontrada"); setButtonStatus("⚠️ SEM CAIXA", false); return; }
      await inserirTexto(campo, reply);
      await enviarMensagem(campo);
      setButtonStatus("🤖 RESPONDIDO", true, 5000);
    }catch(e){
      warn("processarChat erro", e);
    }finally{
      chatsEmProcessamento.delete(chat);
    }
  }

  function agendarResposta(chat){
    const prev = debounceTimers.get(chat);
    if(prev) clearTimeout(prev);
    const t = setTimeout(()=>{
      debounceTimers.delete(chat);
      processarChat(chat).catch((e)=>warn("agendar", e));
    }, DEBOUNCE_MS);
    debounceTimers.set(chat, t);
  }

  // ============================================================
  // OBSERVER DE NOVAS MENSAGENS
  // ============================================================
  const obs = new MutationObserver((muts)=>{
    let hasIncoming = false;
    for(const m of muts){
      for(const node of m.addedNodes){
        if(!(node instanceof HTMLElement)) continue;
        const candidatos = [];
        if(node.matches?.('[role="row"]')) candidatos.push(node);
        node.querySelectorAll?.('[role="row"]').forEach((r)=>candidatos.push(r));
        for(const r of candidatos){
          if(detectarRoleRow(r) === 'user'){ hasIncoming = true; break; }
        }
        if(hasIncoming) break;
      }
      if(hasIncoming) break;
    }
    if(!hasIncoming) return;
    const chat = getChatId();
    if(!chat) return;
    // só agenda se última mensagem for do contato
    const msgs = lerMensagens(5);
    if(!msgs.length) return;
    if(msgs[msgs.length-1].role !== "user") return;
    agendarResposta(chat);
  });
  function attachObserver(){
    const main = document.querySelector('#main') || document.body;
    obs.disconnect();
    obs.observe(main, { childList:true, subtree:true });
  }

  // ============================================================
  // BOTÃO ON/OFF POR CONTATO
  // ============================================================
  function styleBtn(btn, on){
    const hasOverride = statusOverrideText && Date.now() < statusOverrideUntil;
    btn.textContent = hasOverride ? statusOverrideText : (on ? "🤖 IA: ON" : "🤖 IA: OFF");
    btn.style.background = hasOverride ? (statusOverrideOk ? "#16a34a" : "#dc2626") : (on ? "#16a34a" : "#6b7280");
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.padding = "6px 12px";
    btn.style.borderRadius = "999px";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "600";
    btn.style.cursor = "pointer";
    btn.style.marginRight = "8px";
    btn.style.opacity = on ? "1" : "0.7";
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

  // ============================================================
  // DETECÇÃO DE TROCA DE CHAT — dispara verificação ao abrir
  // ============================================================
  function onChatMaybeChanged(){
    const c = getChatId();
    if(c && !nomesIguais(c, lastSeenChat || '')){
      lastSeenChat = c;
      ensureToggleButton();
      log("chat aberto/trocado:", c);
      setTimeout(()=>{
        const atual = getChatId();
        if(!nomesIguais(atual, c)) return;
        const msgs = lerMensagens(5);
        if(msgs.length && msgs[msgs.length-1].role === "user"){
          log("mensagem pendente detectada ao abrir chat:", c);
          agendarResposta(c);
        }
      }, 1500);
    }
  }

  // ============================================================
  // POLLING DE SEGURANÇA — chat aberto
  // ============================================================
  function pollingChatAberto(){
    const chat = getChatId();
    if(!chat) return;
    if(chatsEmProcessamento.has(chat)) return;
    if(debounceTimers.has(chat)) return;
    if(isGroupChat()) return;
    const msgs = lerMensagens(5);
    if(!msgs.length) return;
    if(msgs[msgs.length-1].role !== "user") return;
    log("polling detectou mensagem pendente em:", chat);
    agendarResposta(chat);
  }

  // ============================================================
  // ATENDIMENTO DE CHATS NÃO LIDOS NA SIDEBAR
  // ============================================================
  function buscarChatsNaoLidos(){
    const badges = document.querySelectorAll(
      '#pane-side span[aria-label*="não lida"], #pane-side span[aria-label*="nao lida"], #pane-side span[aria-label*="unread"]'
    );
    const chats = [];
    const vistos = new Set();
    badges.forEach((badge)=>{
      const item = badge.closest('[role="listitem"]') || badge.closest('[role="row"]') || badge.closest('div[tabindex]');
      if(!item) return;
      const tEl = item.querySelector('span[title]');
      const nome = tEl?.getAttribute('title');
      if(!nome || vistos.has(nome)) return;
      vistos.add(nome);
      chats.push({ nome, item });
    });
    return chats;
  }
  let atendendoFila = false;
  async function atenderNaoLidos(){
    if(atendendoFila) return;
    if(!(await getEnabled())) return;
    const fila = buscarChatsNaoLidos();
    if(!fila.length) return;

    // filtra somente chats com IA ativada
    const ativos = [];
    for(const c of fila){
      if(await getChatEnabled(c.nome)) ativos.push(c);
    }
    if(!ativos.length) return;

    atendendoFila = true;
    try{
      for(const chat of ativos){
        if(chatsEmProcessamento.has(chat.nome)) continue;
        log("abrindo chat não lido:", chat.nome);
        const abriu = await abrirChat(chat);
        if(!abriu) continue;
        await esperar(800);
        if(isGroupChat()){ log("grupo, pulando"); continue; }
        const msgs = lerMensagens(5);
        if(msgs.length && msgs[msgs.length-1].role === "user"){
          await processarChat(chat.nome);
        }
        await esperar(1000);
      }
    }finally{
      atendendoFila = false;
    }
  }

  // ============================================================
  // LOOPS
  // ============================================================
  setInterval(()=>{ ensureToggleButton(); onChatMaybeChanged(); attachObserver(); }, 1500);
  setInterval(pollingChatAberto, 5000);
  setInterval(()=>{ atenderNaoLidos().catch((e)=>warn("atenderNaoLidos", e)); }, 7000);

  setTimeout(()=>{ ensureToggleButton(); attachObserver(); lastSeenChat = getChatId(); }, 1500);
  log("extensão ativa v1.0.17. Monitorando chat aberto + polling + chats não lidos na sidebar.");
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
