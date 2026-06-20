import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { zipSync, strToU8 } from "fflate";
import { ICON_16_B64, ICON_48_B64, ICON_128_B64 } from "./extension-icons";
import { EXTENSION_VERSION } from "./extension-version";

// ---------- Extension source files (templates) ----------

const PRODUCTION_ORIGIN = "https://extensaowhatsapp.com.br";

const MANIFEST = (brandName: string, apiOrigin: string) => ({
  manifest_version: 3,
  name: `${brandName} — IA WhatsApp`,
  version: EXTENSION_VERSION,
  description: `Atendimento automático com IA no WhatsApp Web — ${brandName}.`,
  permissions: ["storage", "activeTab", "clipboardWrite", "tabs"],
  host_permissions: ["https://web.whatsapp.com/*", `${apiOrigin}/*`],
  action: {
    default_popup: "popup.html",
    default_icon: { "16": "icon-16.png", "48": "icon-48.png", "128": "icon-128.png" },
  },
  background: { service_worker: "background.js" },
  icons: { "16": "icon-16.png", "48": "icon-48.png", "128": "icon-128.png" },
  minimum_chrome_version: "111",
  content_scripts: [
    {
      matches: ["https://web.whatsapp.com/*"],
      js: ["config.js", "content.js"],
      run_at: "document_idle",
    },
    {
      matches: ["https://web.whatsapp.com/*"],
      js: ["bridge.js"],
      run_at: "document_idle",
      world: "MAIN",
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

const BRIDGE_JS = `// Roda no MAIN world da página: tem acesso aos internals do React do WhatsApp.
// O content script (isolated world) pede ações via window.postMessage.
(function(){
  function norm(s){ return (s||'').replace(/[\\s\\-\\(\\)\\+\\u2011\\u2013]/g,'').toLowerCase(); }
  function nomesIguais(a, b){
    if(!a || !b) return false;
    const na = norm(a), nb = norm(b);
    return na === nb || na.includes(nb) || nb.includes(na);
  }
  function encontrarItem(nome){
    const itens = document.querySelectorAll('#pane-side [role="listitem"], #pane-side [role="row"]');
    for(const item of itens){
      const t = item.querySelector('span[title]')?.getAttribute('title');
      if(t && nomesIguais(t, nome)) return item;
    }
    return null;
  }
  function fakeEvent(el){
    const rect = el.getBoundingClientRect();
    return {
      button:0, buttons:1, ctrlKey:false, metaKey:false, shiftKey:false, altKey:false,
      bubbles:true, cancelable:true, defaultPrevented:false, isTrusted:true,
      type:'click', target:el, currentTarget:el,
      clientX:rect.left+rect.width/2, clientY:rect.top+rect.height/2,
      pageX:rect.left+rect.width/2, pageY:rect.top+rect.height/2,
      nativeEvent:{ stopImmediatePropagation(){}, stopPropagation(){}, preventDefault(){} },
      preventDefault(){ this.defaultPrevented = true; },
      stopPropagation(){},
      isDefaultPrevented(){ return this.defaultPrevented; },
      isPropagationStopped(){ return false; },
      persist(){},
    };
  }
  function tentarHandlers(props, el){
    const ev = fakeEvent(el);
    if(typeof props.onClick === 'function'){ props.onClick(ev); return 'onClick'; }
    if(typeof props.onMouseDown === 'function'){
      props.onMouseDown(ev);
      if(typeof props.onMouseUp === 'function') props.onMouseUp(ev);
      return 'onMouseDown';
    }
    if(typeof props.onPointerDown === 'function'){ props.onPointerDown(ev); return 'onPointerDown'; }
    return null;
  }
  // Procura props React com handler de clique no item, descendentes e ancestrais.
  function reactClick(item){
    const candidatos = [item];
    const desc = item.querySelectorAll('*');
    for(let i = 0; i < desc.length && i < 120; i++) candidatos.push(desc[i]);
    let node = item.parentElement;
    for(let depth = 0; node && depth < 10; depth++){ candidatos.push(node); node = node.parentElement; }
    for(const el of candidatos){
      const key = Object.keys(el).find((k)=>k.startsWith('__reactProps$'));
      if(!key) continue;
      const via = tentarHandlers(el[key], el);
      if(via) return via;
    }
    return null;
  }
  // ---- API interna do WhatsApp (mesma técnica do wa-js / whatsapp-web.js) ----
  function getChatCollection(req){
    const nomes = ['WAWebChatCollection', 'WAWebCollections'];
    for(const m of nomes){
      try{
        const mod = req(m);
        const col = mod && (mod.ChatCollection || mod.Chat);
        if(col && typeof col.getModelsArray === 'function') return col;
      }catch(_e){}
    }
    return null;
  }
  function acharChatModel(col, nome){
    const alvoDigitos = (nome || '').replace(/\\D/g, '');
    for(const c of col.getModelsArray()){
      try{
        const idUser = (c.id && c.id.user) || '';
        if(alvoDigitos.length >= 8 && idUser === alvoDigitos) return c;
        const titulos = [
          c.formattedTitle, c.name,
          c.contact && c.contact.name,
          c.contact && c.contact.pushname,
        ];
        for(const t of titulos){
          if(t && nomesIguais(String(t), nome)) return c;
        }
      }catch(_e){}
    }
    return null;
  }
  function esperar(ms){ return new Promise((r)=>setTimeout(r, ms)); }
  function chatAbertoNoDom(nome){
    const ativo = document.querySelector('#pane-side [aria-selected="true"] span[title]');
    if(ativo && nomesIguais(ativo.getAttribute('title'), nome)) return true;
    const header = document.querySelector('#main header span[title]');
    if(header && nomesIguais(header.getAttribute('title') || header.innerText, nome)) return true;
    return false;
  }
  async function abrirViaStore(nome){
    let req = null;
    try{ if(typeof window.require === 'function') req = window.require; }catch(_e){}
    if(!req) return { ok:false, motivo:'sem-require' };
    let Cmd = null;
    try{ Cmd = req('WAWebCmd').Cmd; }catch(_e){}
    if(!Cmd) return { ok:false, motivo:'sem-cmd' };
    const col = getChatCollection(req);
    if(!col) return { ok:false, motivo:'sem-chat-collection' };
    const chat = acharChatModel(col, nome);
    if(!chat) return { ok:false, motivo:'chat-nao-encontrado-store' };
    const chamadas = [];
    if(typeof Cmd.openChatBottom === 'function'){
      chamadas.push(['openChatBottom-obj', ()=>Cmd.openChatBottom({ chat: chat })]);
      chamadas.push(['openChatBottom', ()=>Cmd.openChatBottom(chat)]);
    }
    if(typeof Cmd.openChatAt === 'function'){
      chamadas.push(['openChatAt-obj', ()=>Cmd.openChatAt({ chat: chat })]);
      chamadas.push(['openChatAt', ()=>Cmd.openChatAt(chat)]);
    }
    if(!chamadas.length) return { ok:false, motivo:'cmd-sem-funcao-abrir' };
    for(const par of chamadas){
      try{
        const r = par[1]();
        if(r && typeof r.catch === 'function') r.catch(()=>{});
      }catch(_e){ continue; }
      // verifica se abriu de verdade antes de aceitar
      await esperar(900);
      if(chatAbertoNoDom(nome)) return { ok:true, via:'store-' + par[0] };
    }
    return { ok:false, motivo:'store-nao-abriu' };
  }
  // ---- leitura de mensagens direto da coleção interna (imune a mudanças de DOM) ----
  const TIPOS_MSG = {
    chat:'', image:'[imagem]', video:'[vídeo]', ptt:'[áudio]', audio:'[áudio]',
    document:'[documento]', sticker:'[figurinha]', location:'[localização]', vcard:'[contato]',
  };
  // marcador invisível anexado a toda mensagem da IA; mensagem nossa SEM o
  // marcador = enviada manualmente (por qualquer PC ou pelo celular)
  const MARCA_IA = '\\u200b\\u2060';
  function lerMensagensStore(nome, limite){
    let req = null;
    try{ if(typeof window.require === 'function') req = window.require; }catch(_e){}
    if(!req) return { ok:false, motivo:'sem-require' };
    const col = getChatCollection(req);
    if(!col) return { ok:false, motivo:'sem-chat-collection' };
    const chat = acharChatModel(col, nome);
    if(!chat) return { ok:false, motivo:'chat-nao-encontrado-store' };
    let models = [];
    try{ models = chat.msgs.getModelsArray(); }catch(_e){ return { ok:false, motivo:'sem-msgs' }; }
    const out = [];
    for(const m of models){
      try{
        if(!m || !m.type || !(m.type in TIPOS_MSG)) continue;
        const fromMe = !!(m.id && m.id.fromMe);
        let texto = '';
        if(m.type === 'chat') texto = String(m.body || '');
        else texto = TIPOS_MSG[m.type] + (m.caption ? ' ' + String(m.caption) : '');
        texto = texto.trim();
        if(!texto) continue;
        const temMarca = texto.indexOf(MARCA_IA) !== -1;
        if(temMarca) texto = texto.split(MARCA_IA).join('').trim();
        out.push({
          role: fromMe ? 'assistant' : 'user',
          content: texto,
          t: m.t || 0,
          manual: fromMe && !temMarca,
          audio: (m.type === 'ptt' || m.type === 'audio'),
          mtype: m.type,
        });
      }catch(_e){}
    }
    return { ok:true, mensagens: out.slice(-(limite || 20)), grupo: !!chat.isGroup };
  }
  window.addEventListener('message', (ev)=>{
    if(ev.source !== window) return;
    const d = ev.data;
    if(!d || d.__argos !== 'read-messages') return;
    let resp;
    try{ resp = lerMensagensStore(d.nome, d.limite); }
    catch(err){ resp = { ok:false, motivo: String((err && err.message) || err) }; }
    window.postMessage(Object.assign({ __argos:'read-messages-result', reqId: d.reqId }, resp), '*');
  });
  // ---- download + decriptação do áudio mais recente recebido do contato ----
  function arrayBufferParaBase64(buf){
    const bytes = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x8000;
    for(let i = 0; i < bytes.length; i += chunk){
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  async function baixarAudioStore(nome){
    let req = null;
    try{ if(typeof window.require === 'function') req = window.require; }catch(_e){}
    if(!req) return { ok:false, motivo:'sem-require' };
    const col = getChatCollection(req);
    if(!col) return { ok:false, motivo:'sem-chat-collection' };
    const chat = acharChatModel(col, nome);
    if(!chat) return { ok:false, motivo:'chat-nao-encontrado-store' };
    let models = [];
    try{ models = chat.msgs.getModelsArray(); }catch(_e){ return { ok:false, motivo:'sem-msgs' }; }
    // áudio mais recente recebido (não nosso)
    let alvo = null;
    for(let i = models.length - 1; i >= 0; i--){
      const m = models[i];
      if(!m || !m.type) continue;
      if(m.id && m.id.fromMe) continue;
      if(m.type === 'ptt' || m.type === 'audio'){ alvo = m; break; }
    }
    if(!alvo) return { ok:false, motivo:'sem-audio' };
    // os campos de cripto/mídia podem estar no próprio model OU aninhados em
    // mediaData (varia conforme a versão do WhatsApp Web)
    const md = alvo.mediaData || alvo.__x_mediaData || {};
    function campo(k){ return (alvo[k] != null ? alvo[k] : md[k]); }
    async function paraBuffer(res){
      if(!res) return null;
      if(res.arrayBuffer && typeof res.arrayBuffer === 'function') return await res.arrayBuffer();
      if(res instanceof Blob) return await res.arrayBuffer();
      if(res instanceof ArrayBuffer) return res;
      if(res.buffer instanceof ArrayBuffer) return res.buffer;
      if(res._blob instanceof Blob) return await res._blob.arrayBuffer();
      return null;
    }
    let buf = null;
    const erros = [];
    // Extrai um ArrayBuffer de um Blob obtido de uma URL (blob:/data:/https) ou
    // de um objeto blob interno do WhatsApp.
    async function blobUrlParaBuffer(u){
      try{ const r = await fetch(u); const b = await r.blob(); return await b.arrayBuffer(); }
      catch(_e){ return null; }
    }
    async function paraBuffer2(res){
      const b = await paraBuffer(res);
      if(b) return b;
      if(typeof res === 'string' && (res.indexOf('blob:')===0 || res.indexOf('data:')===0 || res.indexOf('http')===0)){
        return await blobUrlParaBuffer(res);
      }
      return null;
    }
    const sleep = (ms)=> new Promise((r)=>setTimeout(r, ms));
    async function blobParaBuffer(b){
      try{ if(b instanceof Blob) return await b.arrayBuffer(); }catch(_e){}
      try{ if(b && typeof b.forceToBlob==='function'){ const bb = b.forceToBlob(); if(bb && bb.arrayBuffer) return await bb.arrayBuffer(); } }catch(_e){}
      try{ if(b && b.arrayBuffer) return await b.arrayBuffer(); }catch(_e){}
      return null;
    }
    // Implementação alinhada ao whatsapp-web.js (resolveMediaBlob): dispara o
    // downloadMedia com rmrReason:1 e lê o blob DECIFRADO do cache em memória
    // do WhatsApp (WAWebMediaInMemoryBlobCache, indexado por filehash) ou do
    // mediaObject.mediaBlob. O áudio real NÃO fica em mediaData (só metadados).
    try{
      if(typeof alvo.downloadMedia === 'function'){
        await alvo.downloadMedia({ downloadEvenIfExpensive:true, rmrReason:1, isUserInitiated:true });
      }
    }catch(e){ erros.push('dlmedia:'+(e&&e.message)); }
    // espera sair de FETCHING/REUPLOADING (até ~6s)
    for(let i=0; i<12; i++){
      const st = (alvo.mediaData && alvo.mediaData.mediaStage) || '';
      if(st && st.indexOf('ERROR')<0 && st!=='FETCHING' && st!=='REUPLOADING' && st!=='NONE') break;
      await sleep(500);
    }
    // 1) cache em memória por filehash (onde o blob decifrado fica)
    if(!buf){
      try{
        const cacheMod = req('WAWebMediaInMemoryBlobCache');
        const cache = cacheMod && (cacheMod.InMemoryMediaBlobCache || cacheMod.default || cacheMod);
        const fh = alvo.mediaObject && alvo.mediaObject.filehash;
        if(cache && typeof cache.get === 'function' && fh){
          const cached = cache.get(fh);
          buf = await blobParaBuffer(cached);
        } else if(!fh){ erros.push('sem-filehash'); }
      }catch(e){ erros.push('cache:'+(e&&e.message)); }
    }
    // 2) mediaObject.mediaBlob.forceToBlob()
    if(!buf){
      try{
        const mo = alvo.mediaObject;
        if(mo && mo.mediaBlob){ buf = await blobParaBuffer(mo.mediaBlob); }
        else if(!mo){ erros.push('sem-mediaObject'); }
        else { erros.push('sem-mediaBlob'); }
      }catch(e){ erros.push('mblob:'+(e&&e.message)); }
    }
    if(!buf){
      const md3 = alvo.mediaData || {};
      erros.push('stage:'+(md3.mediaStage||'?'));
      try{ erros.push('moKeys:'+(alvo.mediaObject?Object.keys(alvo.mediaObject).join(','):'null')); }catch(_e){}
      return { ok:false, motivo:'download-falhou', detalhe: erros.join(' | ').slice(0,400) };
    }
    const mime = String(alvo.mimetype || campo('mimetype') || 'audio/ogg').split(';')[0];
    try{ console.log('%c[Argos]','color:#16a34a;font-weight:bold',"áudio baixado: " + buf.byteLength + " bytes, mime " + mime); }catch(_e){}
    return { ok:true, base64: arrayBufferParaBase64(buf), mime: mime, seconds: Number(alvo.duration || campo('duration') || 0), bytes: buf.byteLength };
  }
  window.addEventListener('message', async (ev)=>{
    if(ev.source !== window) return;
    const d = ev.data;
    if(!d || d.__argos !== 'get-audio') return;
    let resp;
    try{ resp = await baixarAudioStore(d.nome); }
    catch(err){ resp = { ok:false, motivo: String((err && err.message) || err) }; }
    window.postMessage(Object.assign({ __argos:'get-audio-result', reqId: d.reqId }, resp), '*');
  });
  // ---- envio de mensagem direto pela API interna (sem abrir o chat na UI) ----
  async function enviarViaStore(nome, texto, keepUnread){
    let req = null;
    try{ if(typeof window.require === 'function') req = window.require; }catch(_e){}
    if(!req) return { ok:false, motivo:'sem-require' };
    const col = getChatCollection(req);
    if(!col) return { ok:false, motivo:'sem-chat-collection' };
    const chat = acharChatModel(col, nome);
    if(!chat) return { ok:false, motivo:'chat-nao-encontrado-store' };
    let addAndSend = null;
    try{ addAndSend = req('WAWebSendMsgChatAction').addAndSendMsgToChat; }catch(_e){}
    if(typeof addAndSend !== 'function') return { ok:false, motivo:'sem-addAndSendMsgToChat' };
    // MsgKey/me: tenta os módulos e, se falhar, deriva de mensagens existentes
    let MsgKey = null, me = null;
    try{
      const mod = req('WAWebMsgKey');
      MsgKey = (mod && (mod.default || mod.MsgKey)) || (typeof mod === 'function' ? mod : null);
    }catch(_e){}
    try{ me = req('WAWebUserPrefsMeUser').getMaybeMeUser(); }catch(_e){}
    let modelos = [];
    try{ modelos = chat.msgs.getModelsArray(); }catch(_e){}
    for(let i = modelos.length - 1; i >= 0 && (!MsgKey || !me); i--){
      const m = modelos[i];
      try{
        if(!MsgKey && m && m.id && typeof m.id.constructor === 'function') MsgKey = m.id.constructor;
        if(!me && m && m.id && m.id.fromMe && m.from) me = m.from;
      }catch(_e){}
    }
    if(!MsgKey) return { ok:false, motivo:'sem-msgkey' };
    if(!me) return { ok:false, motivo:'sem-meuser' };
    try{
      let novoId = null;
      try{
        novoId = typeof MsgKey.newId === 'function' ? MsgKey.newId() : null;
        if(novoId && typeof novoId.then === 'function') novoId = await novoId;
      }catch(_e){}
      if(!novoId){
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        novoId = Array.prototype.map.call(bytes, (b)=>('0'+b.toString(16)).slice(-2)).join('').toUpperCase();
      }
      const key = new MsgKey({ from: me, to: chat.id, id: novoId, participant: undefined, selfDir: 'out' });
      const msg = {
        id: key, ack: 0, body: texto + MARCA_IA, from: me, to: chat.id,
        local: true, self: 'out', t: Math.floor(Date.now()/1000),
        isNewMsg: true, type: 'chat',
      };
      const r = addAndSend(chat, msg);
      if(r && typeof r.then === 'function') await r;
      // mídia: não limpa o badge — o dono precisa ver que chegou algo
      const seen = keepUnread ? false : marcarLido(req, chat);
      return { ok:true, via:'store-send', seen: seen };
    }catch(e){
      return { ok:false, motivo:'send-erro: ' + String((e && e.message) || e) };
    }
  }
  function marcarLido(req, chat){
    const mods = ['WAWebUpdateUnreadChatAction', 'WAWebSendSeenChatAction', 'WAWebSeenChatAction'];
    for(const nomeMod of mods){
      try{
        const mod = req(nomeMod);
        const fn = mod && (mod.sendSeen || mod.markSeen || mod.default);
        if(typeof fn === 'function'){
          const p = fn(chat);
          if(p && typeof p.catch === 'function') p.catch(()=>{});
          return true;
        }
      }catch(_e){}
    }
    return false;
  }
  // marca o chat como NÃO LIDO (badge), para o dono perceber que precisa olhar.
  // Os nomes de módulo do WhatsApp mudam entre versões — tentamos várias vias e
  // reportamos qual funcionou (ou o motivo da falha).
  async function marcarNaoLido(req, chat){
    const erros = [];
    // 1) ação canônica markUnread (assíncrona)
    for(const nomeMod of ['WAWebMarkChatUnreadAction','WAWebUpdateUnreadChatAction','WAWebChatMarkingAction']){
      try{
        const mod = req(nomeMod);
        const fn = mod && (mod.markUnread || mod.sendMarkUnread || mod.updateUnread || mod.markChatUnread);
        if(typeof fn === 'function'){
          await fn(chat, true);
          return { ok:true, via:nomeMod };
        }
      }catch(e){ erros.push(nomeMod+':'+(e&&e.message)); }
    }
    // 2) método no próprio model do chat
    try{ if(typeof chat.markUnread === 'function'){ await chat.markUnread(); return { ok:true, via:'chat.markUnread' }; } }catch(e){ erros.push('chat.markUnread:'+(e&&e.message)); }
    // 3) fallback bruto: força o contador de não-lidas no model
    try{
      if(chat.setUnreadCount){ chat.setUnreadCount(chat.unreadCount > 0 ? chat.unreadCount : -1); }
      else { chat.unreadCount = (chat.unreadCount > 0 ? chat.unreadCount : 1); }
      return { ok:true, via:'unreadCount' };
    }catch(e){ erros.push('unreadCount:'+(e&&e.message)); }
    return { ok:false, motivo: erros.join(' | ').slice(0,200) };
  }
  window.addEventListener('message', async (ev)=>{
    if(ev.source !== window) return;
    const d = ev.data;
    if(!d || d.__argos !== 'mark-unread') return;
    let resp = { ok:false };
    try{
      let req = null;
      try{ if(typeof window.require === 'function') req = window.require; }catch(_e){}
      const col = req ? getChatCollection(req) : null;
      const chat = col ? acharChatModel(col, d.nome) : null;
      if(req && chat) resp = await marcarNaoLido(req, chat);
      else resp = { ok:false, motivo: !req ? 'sem-require' : 'chat-nao-encontrado' };
    }catch(err){ resp = { ok:false, motivo:String((err&&err.message)||err) }; }
    window.postMessage(Object.assign({ __argos:'mark-unread-result', reqId: d.reqId }, resp), '*');
  });
  window.addEventListener('message', (ev)=>{
    if(ev.source !== window) return;
    const d = ev.data;
    if(!d || d.__argos !== 'mark-seen') return;
    let resp = { ok:false };
    try{
      let req = null;
      try{ if(typeof window.require === 'function') req = window.require; }catch(_e){}
      const col = req ? getChatCollection(req) : null;
      const chat = col ? acharChatModel(col, d.nome) : null;
      if(req && chat) resp = { ok: marcarLido(req, chat) };
    }catch(_e){}
    window.postMessage(Object.assign({ __argos:'mark-seen-result', reqId: d.reqId }, resp), '*');
  });
  window.addEventListener('message', (ev)=>{
    if(ev.source !== window) return;
    const d = ev.data;
    if(!d || d.__argos !== 'get-me') return;
    let resp = { ok:false };
    try{
      let req = null;
      try{ if(typeof window.require === 'function') req = window.require; }catch(_e){}
      let me = null;
      try{ if(req) me = req('WAWebUserPrefsMeUser').getMaybeMeUser(); }catch(_e){}
      let numero = null;
      try{
        if(me && me.user) numero = String(me.user);
        else if(me && me._serialized) numero = String(me._serialized).split('@')[0];
      }catch(_e){}
      if(numero) resp = { ok:true, numero: numero };
    }catch(_e){}
    window.postMessage(Object.assign({ __argos:'get-me-result', reqId: d.reqId }, resp), '*');
  });
  window.addEventListener('message', async (ev)=>{
    if(ev.source !== window) return;
    const d = ev.data;
    if(!d || d.__argos !== 'send-message') return;
    let resp;
    try{ resp = await enviarViaStore(d.nome, d.texto, d.keepUnread); }
    catch(err){ resp = { ok:false, motivo: String((err && err.message) || err) }; }
    window.postMessage(Object.assign({ __argos:'send-message-result', reqId: d.reqId }, resp), '*');
  });
  window.addEventListener('message', async (ev)=>{
    if(ev.source !== window) return;
    const d = ev.data;
    if(!d || d.__argos !== 'open-chat') return;
    let ok = false, via = '', motivo = '';
    try{
      // ESTRATÉGIA A: API interna (Cmd.openChatBottom) — não depende do DOM
      if(d.modo !== 'react'){
        const r = await abrirViaStore(d.nome);
        if(r.ok){ ok = true; via = r.via; }
        else motivo = r.motivo;
      }
      // ESTRATÉGIA B: handlers React no item da sidebar
      if(!ok){
        const item = d.nome ? encontrarItem(d.nome) : null;
        if(!item){
          motivo = (motivo ? motivo + '+' : '') + 'item-nao-encontrado';
        }else{
          item.scrollIntoView({ block:'center' });
          via = reactClick(item);
          if(via){ ok = true; }
          else motivo = (motivo ? motivo + '+' : '') + 'sem-handler-react';
        }
      }
    }catch(err){ motivo = String((err && err.message) || err); }
    window.postMessage({ __argos:'open-chat-result', reqId: d.reqId, ok, via, motivo }, '*');
  });
  console.log('%c[Argos]','color:#16a34a;font-weight:bold','bridge MAIN world ativo');
})();
`;

const CONTENT_JS = `// Conteúdo injetado no WhatsApp Web. Lê mensagens novas e responde via API Argos.
(function(){
  const CFG = window.__ARGOS_CONFIG__ || {};
  const log = (...a)=>console.log("%c[Argos]","color:#16a34a;font-weight:bold", ...a);
  const warn = (...a)=>console.warn("[Argos]", ...a);
  if(!CFG.apiKey || !CFG.endpoint){warn("config ausente");return;}
  log("inicializando v1.0.46. endpoint =", CFG.endpoint);

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
  const chatsPendentes = new Set(); // respostas adiadas (operador ativo, chat trocado...)
  const respostasProntas = new Map(); // chat -> {hash, reply}: resposta obtida mas ainda não enviada
  // cache do último áudio baixado por chat (evita rebaixar o mesmo áudio em
  // passadas repetidas do loop / disputas de instância)
  const audioCache = new Map(); // chat -> {hash, audio}
  // cooldown por chat após um "skip" (outra instância/passada reivindicou):
  // evita reprocessar o mesmo chat em rajada antes da resposta sair.
  const skipCooldown = new Map(); // chat -> timestamp até quando ignorar
  const SKIP_COOLDOWN_MS = 8000;
  // claim LOCAL por chat+hash: evita que os dois gatilhos da MESMA instância
  // (observer/debounce e o loop atenderNaoLidos) processem a mesma mensagem em
  // paralelo e disputem o claim no servidor (causa do "outra instância
  // reivindicou" mesmo com uma só aba).
  const claimsLocais = new Map(); // "chat:hash" -> ts
  const CLAIM_LOCAL_TTL_MS = 90000;
  function jaProcessando(chave){
    const t = claimsLocais.get(chave);
    return t && (Date.now() - t < CLAIM_LOCAL_TTL_MS);
  }
  const debounceTimers = new Map(); // chat -> timer id
  // Faxina periódica: impede que os caches cresçam sem limite ao longo de
  // dias com a aba aberta. Remove entradas antigas e limita o tamanho.
  const CACHE_TTL_MS = 30 * 60_000; // 30 min sem uso → descarta
  const CACHE_MAX = 200;            // teto de entradas por cache
  function podarMap(m, ehTimestamp){
    const agora = Date.now();
    for(const [k, v] of m){
      const t = ehTimestamp ? v : (v && v.ts);
      if(!t || agora - t > CACHE_TTL_MS) m.delete(k);
    }
    // se ainda estourar o teto, remove os mais antigos
    if(m.size > CACHE_MAX){
      const ents = [...m.entries()].sort((a,b)=>{
        const ta = ehTimestamp ? a[1] : (a[1] && a[1].ts) || 0;
        const tb = ehTimestamp ? b[1] : (b[1] && b[1].ts) || 0;
        return ta - tb;
      });
      const remover = m.size - CACHE_MAX;
      for(let i=0; i<remover; i++) m.delete(ents[i][0]);
    }
  }
  function faxinaCaches(){
    try{
      podarMap(respostasProntas, false);
      podarMap(audioCache, false);
      podarMap(claimsLocais, true);
      podarMap(skipCooldown, true); // valor é o próprio timestamp (futuro)
      // skipCooldown: entradas já vencidas não servem mais
      const agora = Date.now();
      for(const [k, v] of skipCooldown){ if(typeof v === 'number' && v < agora - CACHE_TTL_MS) skipCooldown.delete(k); }
    }catch(_e){}
  }
  let statusOverrideText = null;
  let statusOverrideOk = true;
  let statusOverrideUntil = 0;
  let lastSeenChat = null;

  // ============================================================
  // ATIVIDADE DO OPERADOR — a IA só mexe na interface quando
  // o humano está ocioso (eventos sintéticos têm isTrusted=false
  // e não contam, então as ações da própria IA não se bloqueiam)
  // ============================================================
  const HUMANO_OCIOSO_MS = 20000;
  let lastHumanActivity = 0;
  let ultimoLogHumano = 0;
  ['mousedown','keydown','wheel','touchstart'].forEach((t)=>{
    window.addEventListener(t, (e)=>{ if(e.isTrusted) lastHumanActivity = Date.now(); }, true);
  });
  function humanoAtivo(){ return Date.now() - lastHumanActivity < HUMANO_OCIOSO_MS; }
  function logHumanoAtivo(acao){
    if(Date.now() - ultimoLogHumano > 60000){
      ultimoLogHumano = Date.now();
      log("operador usando a janela —", acao, "adiado até ficar ocioso por " + (HUMANO_OCIOSO_MS/1000) + "s");
    }
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
  // momento em que a IA foi (re)ativada para o chat — mensagens manuais
  // anteriores a isso não voltam a desativá-la
  function chatEnabledAtKey(chat){ return "chatAt:"+chat; }
  function getChatEnabledAt(chat){
    return new Promise((res)=>chrome.storage.local.get([chatEnabledAtKey(chat)],(r)=>{
      res(r[chatEnabledAtKey(chat)] || 0);
    }));
  }
  function setChatEnabledAt(chat, ts){
    return new Promise((res)=>chrome.storage.local.set({[chatEnabledAtKey(chat)]: ts}, ()=>res()));
  }
  // mesma marca invisível usada pelo bridge ao enviar
  const MARCA_IA = '\\u200b\\u2060';
  // marco inicial: mensagens anteriores a isso não contam como intervenção
  // (respostas da IA antigas, antes do marcador existir, não têm a marca)
  let manualDetectSince = 0;
  chrome.storage.local.get(['manualDetectSince'], (r)=>{
    if(r.manualDetectSince){
      manualDetectSince = r.manualDetectSince;
    }else{
      manualDetectSince = Date.now();
      chrome.storage.local.set({ manualDetectSince: manualDetectSince });
    }
  });
  // migração v1.0.26: a v1.0.25 desativou chats por engano (respostas
  // antigas da IA, sem marcador, pareciam manuais) — reativa tudo 1 vez
  chrome.storage.local.get(null, (all)=>{
    if(all.migracaoV26) return;
    const remover = Object.keys(all).filter((k)=>k.indexOf('chat:') === 0);
    const concluir = ()=>chrome.storage.local.set({ migracaoV26: true }, ()=>{
      if(remover.length) log("migração: IA reativada em", remover.length, "chats desativados por engano");
    });
    if(remover.length) chrome.storage.local.remove(remover, concluir);
    else concluir();
  });
  async function desativarPorIntervencao(chat, origem){
    if(!(await getChatEnabled(chat))) return;
    await setChatEnabled(chat, false);
    chatsPendentes.delete(chat);
    respostasProntas.delete(chat);
    log("intervenção manual (" + origem + ") — IA desativada para:", chat, "| reative no botão IA");
    setButtonStatus("🤖 IA: OFF", false, 4000);
    ensureToggleButton();
  }
  function temIntervencaoManual(mensagens, enabledAt){
    const desde = Math.max(enabledAt || 0, manualDetectSince || 0);
    if(!desde) return false; // marco inicial ainda carregando
    return mensagens.some((m)=>m.manual && ((m.t || 0) * 1000) > desde);
  }
  // desliga a IA do chat aberto assim que o operador digita na caixa de mensagem
  window.addEventListener('keydown', (e)=>{
    if(!e.isTrusted) return;
    const alvo = e.target;
    if(!(alvo instanceof HTMLElement)) return;
    if(!alvo.closest('#main footer')) return;
    if(e.key !== 'Enter' && e.key !== 'Backspace' && (typeof e.key !== 'string' || e.key.length !== 1)) return;
    const c = getChatId();
    if(!c) return;
    desativarPorIntervencao(c, "digitação").catch(()=>{});
  }, true);

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
    try{ elemento.scrollIntoView({ block:'center' }); }catch(_e){}
    const rect = elemento.getBoundingClientRect();
    const x = rect.left + rect.width/2;
    const y = rect.top + rect.height/2;
    const opts = { bubbles:true, cancelable:true, view:window, clientX:x, clientY:y, button:0 };
    const pOpts = Object.assign({ pointerId:1, pointerType:'mouse', isPrimary:true }, opts);
    // WhatsApp Web (React) escuta pointer events; sem eles o clique é ignorado
    elemento.dispatchEvent(new PointerEvent('pointerover', pOpts));
    elemento.dispatchEvent(new MouseEvent('mouseover', opts));
    elemento.dispatchEvent(new PointerEvent('pointerdown', pOpts));
    elemento.dispatchEvent(new MouseEvent('mousedown', opts));
    elemento.dispatchEvent(new PointerEvent('pointerup', pOpts));
    elemento.dispatchEvent(new MouseEvent('mouseup', opts));
    elemento.dispatchEvent(new MouseEvent('click', opts));
  }
  function encontrarItemPorNome(nome){
    const itens = document.querySelectorAll('#pane-side [role="listitem"], #pane-side [role="row"]');
    for(const item of itens){
      const t = item.querySelector('span[title]')?.getAttribute('title');
      if(t && nomesIguais(t, nome)) return item;
    }
    return null;
  }
  // ---- BRIDGE no MAIN world (API interna do WhatsApp + handlers React) ----
  let bridgeReqSeq = 0;
  function bridgeRequest(tipo, payload, timeoutMs){
    return new Promise((res)=>{
      const reqId = ++bridgeReqSeq;
      let done = false;
      const to = setTimeout(()=>{
        if(done) return;
        done = true;
        window.removeEventListener('message', onMsg);
        res({ ok:false, motivo:'bridge-timeout' });
      }, timeoutMs || 8000);
      function onMsg(ev){
        if(ev.source !== window) return;
        const d = ev.data;
        if(!d || d.__argos !== tipo + '-result' || d.reqId !== reqId) return;
        if(done) return;
        done = true;
        clearTimeout(to);
        window.removeEventListener('message', onMsg);
        res(d);
      }
      window.addEventListener('message', onMsg);
      window.postMessage(Object.assign({ __argos: tipo, reqId: reqId }, payload || {}), '*');
    });
  }
  function abrirViaBridge(nome, modo){
    return bridgeRequest('open-chat', { nome: nome, modo: modo || 'auto' }, 8000);
  }
  // Lê mensagens pela coleção interna do WhatsApp; cai para o DOM se indisponível.
  async function lerMensagensConfiavel(nome, limite){
    const r = await bridgeRequest('read-messages', { nome: nome, limite: limite }, 4000);
    if(r && r.ok && Array.isArray(r.mensagens)){
      if(r.mensagens.length) return r.mensagens;
    }else if(r && r.motivo){
      log("leitura via store falhou (" + r.motivo + "), usando DOM");
    }
    return lerMensagens(limite);
  }
  // ---- ESTRATÉGIA 3: busca pelo nome na caixa de pesquisa ----
  const SELETORES_BUSCA = [
    'div[contenteditable="true"][data-tab="3"]',
    '#side div[contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="esquis"]',
    'div[contenteditable="true"][aria-label*="earch"]',
    'div[contenteditable="true"][role="textbox"]:not([data-tab="10"])',
  ];
  const SELETORES_ABRIR_BUSCA = [
    'button[aria-label*="esquis"]',
    'button[aria-label*="earch"]',
    'span[data-icon="search"]',
    'span[data-icon="search-refreshed"]',
  ];
  const SELETORES_LIMPAR_BUSCA = [
    'button[aria-label="Cancelar pesquisa"]',
    'button[aria-label="Cancel search"]',
    'span[data-icon="x-alt"]',
    'span[data-icon="x"]',
  ];
  function limparBusca(){
    const btn = buscarElemento(SELETORES_LIMPAR_BUSCA);
    if(btn) btn.click();
  }
  async function abrirViaBusca(nome){
    let campo = buscarElemento(SELETORES_BUSCA);
    if(campo && campo.closest('#main')) campo = null; // não confundir com a caixa de mensagem
    if(!campo){
      // a caixa pode só existir depois de clicar no botão de pesquisa
      const abrir = buscarElemento(SELETORES_ABRIR_BUSCA);
      if(abrir){
        simularCliqueReal(abrir);
        await esperar(600);
        campo = buscarElemento(SELETORES_BUSCA);
        if(campo && campo.closest('#main')) campo = null;
      }
    }
    if(!campo){ log("busca: campo de pesquisa não encontrado"); return false; }
    simularCliqueReal(campo);
    campo.focus();
    await esperar(300);
    try{
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, nome);
    }catch(_e){}
    campo.dispatchEvent(new InputEvent('input', { bubbles:true, cancelable:true, inputType:'insertText', data:nome }));
    await esperar(1500);
    // abre o primeiro resultado: handler React -> clique simulado -> Enter
    const r = await abrirViaBridge(nome);
    if(!r.ok){
      const resultado = encontrarItemPorNome(nome);
      if(resultado){
        simularCliqueReal(resultado.querySelector('div[tabindex]') || resultado);
      }else{
        const kOpts = { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true, cancelable:true };
        campo.dispatchEvent(new KeyboardEvent('keydown', kOpts));
        campo.dispatchEvent(new KeyboardEvent('keyup', kOpts));
      }
    }
    await esperar(1200);
    limparBusca();
    return nomesIguais(getChatId(), nome);
  }
  async function abrirChat(chat){
    const nome = chat.nome;
    // ESTRATÉGIA 1: bridge (1ª tentativa: API interna do WhatsApp; 2ª: handlers React)
    const modos = ['auto', 'react'];
    for(let i = 0; i < modos.length; i++){
      const r = await abrirViaBridge(nome, modos[i]);
      if(r.ok){
        await esperar(1200);
        if(nomesIguais(getChatId(), nome)){
          log("chat aberto via bridge (" + (r.via || '') + "):", nome);
          return true;
        }
      }
      log("bridge modo", modos[i], "falhou:", r.motivo || r.via || '?');
      await esperar(400);
    }
    // ESTRATÉGIA 2: sequência completa de pointer/mouse events
    let item = chat.item;
    if(!item || !item.isConnected) item = encontrarItemPorNome(nome);
    if(item){
      const alvos = [
        item.querySelector('div[tabindex]'),
        item.querySelector('div[role="button"]'),
        item.firstElementChild,
        item,
      ].filter(Boolean);
      for(const alvo of alvos){
        if(!alvo.isConnected) continue;
        simularCliqueReal(alvo);
        await esperar(1200);
        if(nomesIguais(getChatId(), nome)){
          log("chat aberto via clique simulado:", nome);
          return true;
        }
      }
      log("clique simulado não abriu:", nome);
    }else{
      log("item não está na sidebar:", nome);
    }
    // ESTRATÉGIA 3: pesquisa pelo nome
    log("tentando abrir via pesquisa:", nome);
    if(await abrirViaBusca(nome)){
      log("chat aberto via pesquisa:", nome);
      return true;
    }
    warn("não foi possível abrir o chat:", nome);
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
  function hashTexto(s){
    let h = 5381;
    for(let i = 0; i < s.length; i++){ h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
    return h.toString(36);
  }
  // identidade do computador (persistida) — usada no limite de PCs por plano
  let deviceId = null;
  const deviceIdPronto = new Promise((res)=>{
    chrome.storage.local.get(["deviceId"],(r)=>{
      if(r.deviceId){ deviceId = r.deviceId; res(deviceId); return; }
      let novo = null;
      try{ novo = crypto.randomUUID(); }catch(_e){}
      if(!novo) novo = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      chrome.storage.local.set({ deviceId: novo }, ()=>{ deviceId = novo; res(novo); });
    });
  });
  // número do WhatsApp conectado (via bridge) — o servidor compara com o
  // número cadastrado no painel
  let meNumber = null;
  async function obterMeNumber(){
    if(meNumber) return meNumber;
    const r = await bridgeRequest('get-me', {}, 3000);
    if(r && r.ok && r.numero) meNumber = r.numero;
    return meNumber;
  }
  // se a última mensagem do cliente é áudio, baixa o conteúdo p/ transcrição
  async function obterAudioSeNecessario(nome, messages, hashUltima){
    try{
      const ultima = messages[messages.length-1];
      if(!ultima || ultima.role !== 'user' || !ultima.audio) return null;
      // reusa o áudio já baixado para a mesma mensagem (evita rebaixar)
      const c = audioCache.get(nome);
      if(c && c.hash === hashUltima && c.audio){
        return c.audio;
      }
      const r = await bridgeRequest('get-audio', { nome: nome }, 12000);
      if(r && r.ok && r.base64){
        log("áudio capturado p/ transcrição (" + (r.seconds||0) + "s)");
        const audio = { base64: r.base64, mime: r.mime, seconds: r.seconds };
        if(hashUltima) audioCache.set(nome, { hash: hashUltima, audio: audio, ts: Date.now() });
        return audio;
      }
      log("áudio não pôde ser baixado (" + ((r && r.motivo) || '?') + ")" + ((r && r.detalhe) ? " :: " + r.detalhe : ""));
    }catch(_e){}
    return null;
  }
  async function askAI(messages, sessionId, dedupeKey, audio){
    try{
      log("IA <-", messages.length, "msgs (session:", sessionId, ")");
      await deviceIdPronto;
      const numero = await obterMeNumber();
      const ultima = messages[messages.length-1];
      const mediaType = (ultima && ultima.role === 'user') ? (ultima.mtype || undefined) : undefined;
      const r = await fetch(CFG.endpoint, {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":CFG.apiKey},
        body: JSON.stringify({ messages, sessionId, dedupeKey, deviceId: deviceId || undefined, meNumber: numero || undefined, audio: audio || undefined, mediaType: mediaType }),
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){ warn("API erro", r.status, j); setButtonStatus("⚠️ "+(j.message||j.error||r.status), false); return null; }
      if(j.skip){ log("outra instância reivindicou esta resposta"); return { skip:true }; }
      if(j.audioError){ warn("transcrição de áudio falhou no servidor:", j.audioError); }
      log("IA ->", j.reply);
      // resposta de mídia: envia o texto fixo (se houver) mas deixa o chat
      // não-lido p/ o dono ver; keepUnread vem mesmo quando reply é nulo
      if(j.keepUnread) return { reply: j.reply || null, keepUnread: true };
      return j.reply ? { reply: j.reply } : null;
    }catch(e){ warn("fetch erro", e); setButtonStatus("⚠️ SEM API", false); return null; }
  }

  // ============================================================
  // PROCESSAMENTO PRINCIPAL (após debounce)
  // ============================================================
  async function processarChat(chat, replyPronto){
    if(chatsEmProcessamento.has(chat)) return;
    chatsEmProcessamento.add(chat);
    try{
      if(!(await getEnabled())){ log("global off"); return; }
      if(!nomesIguais(getChatId(), chat)){ log("chat mudou durante debounce"); chatsPendentes.add(chat); return; }
      if(isGroupChat()){ log("grupo ignorado:", chat); chatsPendentes.delete(chat); return; }
      if(!(await getChatEnabled(chat))){ log("chat off:", chat); chatsPendentes.delete(chat); return; }
      if(isUserTyping()){ log("usuário digitando, deixando pendente:", chat); chatsPendentes.add(chat); return; }

      const mensagens = await lerMensagensConfiavel(chat, 20);
      log("total de mensagens lidas:", mensagens.length, "chat:", chat);
      if(!mensagens.length){ warn("nenhuma mensagem lida — verificar seletores da área de mensagens"); return; }
      if(temIntervencaoManual(mensagens, await getChatEnabledAt(chat))){
        await desativarPorIntervencao(chat, "mensagem manual");
        return;
      }
      const ultima = mensagens[mensagens.length-1];
      log("ultima eh do contato?", ultima.role === "user", "| texto:", ultima.content.slice(0,60));
      if(ultima.role !== "user"){ log("última é nossa, não responder"); chatsPendentes.delete(chat); return; }

      let reply = replyPronto || null;
      // inclui o timestamp da última mensagem: dois áudios diferentes têm o
      // mesmo content ("[áudio]"), então sem o 't' colidiriam no dedupe e o
      // 2º áudio receberia "skip" sem ser respondido.
      const hashUltima = hashTexto(ultima.content) + ":" + mensagens.length + ":" + (ultima.t || 0);
      if(!reply){
        const cache = respostasProntas.get(chat);
        if(cache && cache.hash === hashUltima) reply = cache.reply;
      }
      if(!reply){
        const chaveLocal = chat + ":" + hashUltima;
        if(jaProcessando(chaveLocal)) return;
        claimsLocais.set(chaveLocal, Date.now());
        setButtonStatus("🤖 LENDO...", true, 4000);
        const sessionId = CFG.apiKey + ":" + chat;
        const dedupeKey = chaveLocal;
        const audio = await obterAudioSeNecessario(chat, mensagens, hashUltima);
        const resp = await askAI(mensagens, sessionId, dedupeKey, audio);
        if(!resp) return;
        if(resp.skip){ return; }
        // mídia (imagem/doc/vídeo): texto fixo + marca não lido p/ o dono ver
        if(resp.keepUnread){
          if(resp.reply){
            const campoM = buscarElemento(SELETORES_INPUT);
            if(campoM){ await inserirTexto(campoM, resp.reply + MARCA_IA); await enviarMensagem(campoM); await esperar(1200); }
          }
          const mu = await bridgeRequest('mark-unread', { nome: chat }, 3000);
          log("mídia: marcado não-lido?", (mu && mu.ok), (mu && mu.via) ? ("(" + mu.via + ")") : "", (mu && mu.motivo) ? mu.motivo : "");
          chatsPendentes.delete(chat);
          setButtonStatus("📎 MÍDIA — VER", false, 5000);
          return;
        }
        reply = resp.reply;
        if(!reply) return;
        respostasProntas.set(chat, { hash: hashUltima, reply: reply, ts: Date.now() });
      }

      // delay humanizado 1.5s - 4s
      const delay = 1500 + Math.random() * 2500;
      setButtonStatus("🤖 DIGITANDO...", true, Math.ceil(delay)+1500);
      await esperar(delay);

      if(isUserTyping()){ log("usuário começou a digitar, deixando pendente:", chat); chatsPendentes.add(chat); return; }
      if(!nomesIguais(getChatId(), chat)){ log("chat mudou antes de enviar, deixando pendente:", chat); chatsPendentes.add(chat); return; }
      if(humanoAtivo()){ logHumanoAtivo("envio da resposta"); chatsPendentes.add(chat); return; }

      const campo = buscarElemento(SELETORES_INPUT);
      if(!campo){ warn("caixa de envio não encontrada"); setButtonStatus("⚠️ SEM CAIXA", false); return; }
      await inserirTexto(campo, reply + MARCA_IA);
      await enviarMensagem(campo);
      chatsPendentes.delete(chat);
      respostasProntas.delete(chat);
      setButtonStatus("🤖 RESPONDIDO", true, 5000);
    }catch(e){
      warn("processarChat erro", e);
    }finally{
      chatsEmProcessamento.delete(chat);
    }
  }

  // ============================================================
  // PROCESSAMENTO HEADLESS — responde pela API interna sem nunca
  // trocar a janela; o operador continua conversando em paralelo
  // ============================================================
  async function processarChatHeadless(nome){
    if(chatsEmProcessamento.has(nome)) return "ok";
    const cd = skipCooldown.get(nome);
    if(cd && Date.now() < cd) return "ok"; // aguardando: alguém já reivindicou há pouco
    chatsEmProcessamento.add(nome);
    try{
      if(!(await getEnabled())) return "ok";
      if(!(await getChatEnabled(nome))){ chatsPendentes.delete(nome); return "ok"; }
      const r = await bridgeRequest('read-messages', { nome: nome, limite: 20 }, 4000);
      if(!r || !r.ok || !Array.isArray(r.mensagens)){
        log("headless: leitura via store indisponível (" + ((r && r.motivo) || '?') + ")");
        return "fallback-ui";
      }
      if(r.grupo){ log("grupo ignorado:", nome); chatsPendentes.delete(nome); return "ok"; }
      const mensagens = r.mensagens;
      if(!mensagens.length) return "ok";
      if(temIntervencaoManual(mensagens, await getChatEnabledAt(nome))){
        await desativarPorIntervencao(nome, "mensagem manual");
        return "ok";
      }
      const ultima = mensagens[mensagens.length-1];
      if(ultima.role !== "user"){
        chatsPendentes.delete(nome);
        bridgeRequest('mark-seen', { nome: nome }, 3000); // já respondido: limpa o badge
        return "ok";
      }
      // se o operador está com ESTE chat aberto e usando a janela, é dele
      if(nomesIguais(getChatId(), nome) && (humanoAtivo() || isUserTyping())){
        chatsPendentes.add(nome);
        return "ok";
      }
      log("headless: respondendo", nome, "| última:", ultima.content.slice(0, 60));
      // inclui o timestamp da última mensagem: dois áudios diferentes têm o
      // mesmo content ("[áudio]"), então sem o 't' colidiriam no dedupe e o
      // 2º áudio receberia "skip" sem ser respondido.
      const hashUltima = hashTexto(ultima.content) + ":" + mensagens.length + ":" + (ultima.t || 0);
      // reusa resposta já obtida (envio anterior falhou) — sem nova chamada à IA
      const cache = respostasProntas.get(nome);
      let reply = (cache && cache.hash === hashUltima) ? cache.reply : null;
      if(!reply){
        const chaveLocal = nome + ":" + hashUltima;
        // se esta MESMA instância já está processando esta mensagem por outro
        // gatilho (observer/loop), não duplica o trabalho
        if(jaProcessando(chaveLocal)) return "ok";
        claimsLocais.set(chaveLocal, Date.now());
        const sessionId = CFG.apiKey + ":" + nome;
        const dedupeKey = chaveLocal;
        const audio = await obterAudioSeNecessario(nome, mensagens, hashUltima);
        const resp = await askAI(mensagens, sessionId, dedupeKey, audio);
        if(!resp) return "ok";
        if(resp.skip){ skipCooldown.set(nome, Date.now() + SKIP_COOLDOWN_MS); return "ok"; }
        // mídia (imagem/doc/vídeo): envia o texto fixo e marca NÃO LIDO p/ o dono
        if(resp.keepUnread){
          if(resp.reply){
            await bridgeRequest('send-message', { nome: nome, texto: resp.reply, keepUnread: true }, 8000);
            // enviar marca o chat como lido; espera o WA processar antes de
            // remarcar como não-lido, senão a marcação não "pega"
            await esperar(1200);
          }
          const mu = await bridgeRequest('mark-unread', { nome: nome }, 3000);
          log("mídia: marcado não-lido?", (mu && mu.ok), (mu && mu.via) ? ("(" + mu.via + ")") : "", (mu && mu.motivo) ? mu.motivo : "");
          chatsPendentes.delete(nome);
          setButtonStatus("📎 MÍDIA — VER", false, 5000);
          return "ok";
        }
        reply = resp.reply;
        if(!reply) return "ok";
        respostasProntas.set(nome, { hash: hashUltima, reply: reply, ts: Date.now() });
      }else{
        log("headless: reusando resposta em cache para", nome);
      }

      // delay humanizado 1.5s - 4s
      await esperar(1500 + Math.random() * 2500);

      // releitura: operador ou outro PC respondeu nesse meio tempo?
      const r2 = await bridgeRequest('read-messages', { nome: nome, limite: 3 }, 4000);
      if(r2 && r2.ok && r2.mensagens && r2.mensagens.length && r2.mensagens[r2.mensagens.length-1].role !== "user"){
        log("headless: alguém já respondeu, cancelando:", nome);
        chatsPendentes.delete(nome);
        respostasProntas.delete(nome);
        return "ok";
      }

      const env = await bridgeRequest('send-message', { nome: nome, texto: reply }, 8000);
      if(env && env.ok){
        log("headless: respondido sem abrir o chat:", nome);
        chatsPendentes.delete(nome);
        respostasProntas.delete(nome);
        audioCache.delete(nome);
        setButtonStatus("🤖 RESPONDIDO", true, 5000);
        return "ok";
      }
      warn("headless: envio via store falhou (" + ((env && env.motivo) || '?') + ")");
      return { fallback: true, reply: reply };
    }catch(e){
      warn("processarChatHeadless erro", e);
      return "fallback-ui";
    }finally{
      chatsEmProcessamento.delete(nome);
    }
  }
  // Orquestra: tenta headless; só usa a interface se o store falhar
  // e o operador estiver ocioso.
  async function responderChat(nome, item){
    const r = await processarChatHeadless(nome);
    if(r === "ok") return;
    const replyPronto = (r && r.fallback && r.reply) || null;
    if(humanoAtivo()){ logHumanoAtivo("resposta visual"); chatsPendentes.add(nome); return; }
    if(!nomesIguais(getChatId(), nome)){
      const abriu = await abrirChat({ nome: nome, item: item || null });
      if(!abriu){ chatsPendentes.add(nome); return; }
      await esperar(800);
    }
    await processarChat(nome, replyPronto);
  }

  function agendarResposta(chat){
    const prev = debounceTimers.get(chat);
    if(prev) clearTimeout(prev);
    const t = setTimeout(()=>{
      debounceTimers.delete(chat);
      responderChat(chat).catch((e)=>warn("agendar", e));
    }, DEBOUNCE_MS);
    debounceTimers.set(chat, t);
  }

  // ============================================================
  // OBSERVER DE NOVAS MENSAGENS
  // ============================================================
  // Throttle: o DOM do WhatsApp muda muito (digitação, status, scroll). Em vez
  // de avaliar a cada mutação, fazemos uma checagem leve no máximo a cada 600ms.
  let obsThrottle = 0;
  let obsAgendado = false;
  const OBS_THROTTLE_MS = 600;
  function avaliarNovasMensagens(){
    const chat = getChatId();
    if(!chat) return;
    const msgs = lerMensagens(5);
    if(!msgs.length) return;
    if(msgs[msgs.length-1].role !== "user") return;
    agendarResposta(chat);
  }
  const obs = new MutationObserver((muts)=>{
    // varredura barata: a mutação adicionou alguma linha de mensagem?
    let mexeu = false;
    for(const m of muts){
      if(m.addedNodes && m.addedNodes.length){ mexeu = true; break; }
    }
    if(!mexeu) return;
    const agora = Date.now();
    if(agora - obsThrottle < OBS_THROTTLE_MS){
      // dentro da janela: agenda uma única avaliação no fim dela
      if(!obsAgendado){
        obsAgendado = true;
        setTimeout(()=>{ obsAgendado = false; obsThrottle = Date.now(); try{ avaliarNovasMensagens(); }catch(_e){} }, OBS_THROTTLE_MS);
      }
      return;
    }
    obsThrottle = agora;
    avaliarNovasMensagens();
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
        if(!cur) await setChatEnabledAt(c, Date.now()); // reativou: zera histórico manual
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
      setTimeout(async ()=>{
        const atual = getChatId();
        if(!nomesIguais(atual, c)) return;
        const msgs = await lerMensagensConfiavel(c, 5);
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
  async function pollingChatAberto(){
    const chat = getChatId();
    if(!chat) return;
    if(chatsEmProcessamento.has(chat)) return;
    if(debounceTimers.has(chat)) return;
    if(isGroupChat()) return;
    const msgs = await lerMensagensConfiavel(chat, 5);
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
    // inclui respostas adiadas (badge já consumido, mas resposta nunca saiu)
    for(const nome of chatsPendentes){
      if(!fila.some((c)=>nomesIguais(c.nome, nome))) fila.push({ nome: nome, item: null });
    }
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
        await responderChat(chat.nome, chat.item);
        await esperar(800);
      }
    }finally{
      atendendoFila = false;
    }
  }

  // ============================================================
  // AVISOS DO ADMIN (comunicado para todos)
  // ============================================================
  const ANNOUNCE_ID = "argos-announcement";
  function announcementUrl(){
    try{ return CFG.endpoint.replace(/\\/ai-reply\\/?$/, "/announcement"); }
    catch(_e){ return null; }
  }
  function mostrarAviso(a){
    if(document.getElementById(ANNOUNCE_ID)) document.getElementById(ANNOUNCE_ID).remove();
    const cor = a.level === 'critical' ? '#dc2626' : (a.level === 'warning' ? '#d97706' : '#16a34a');
    const bar = document.createElement('div');
    bar.id = ANNOUNCE_ID;
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:'+cor+';color:#fff;padding:10px 44px 10px 16px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    const txt = document.createElement('div');
    txt.innerHTML = (a.title ? '<strong>'+String(a.title).replace(/</g,'&lt;')+'</strong> — ' : '') + String(a.body||'').replace(/</g,'&lt;');
    const fechar = document.createElement('button');
    fechar.textContent = '✕';
    fechar.title = 'Fechar aviso';
    fechar.style.cssText = 'position:absolute;top:8px;right:12px;background:transparent;border:0;color:#fff;font-size:16px;cursor:pointer';
    fechar.onclick = ()=>{ try{ localStorage.setItem('argos-announcement-dismissed', a.id); }catch(_e){} bar.remove(); };
    bar.appendChild(txt); bar.appendChild(fechar);
    (document.body || document.documentElement).appendChild(bar);
  }
  async function checarAviso(){
    try{
      const url = announcementUrl();
      if(!url) return;
      const r = await fetch(url, { headers: { 'x-api-key': CFG.apiKey } });
      if(!r.ok) return;
      const j = await r.json().catch(()=>({}));
      const a = j && j.announcement;
      if(!a || !a.id){ const ex = document.getElementById(ANNOUNCE_ID); if(ex) ex.remove(); return; }
      let dispensado = null;
      try{ dispensado = localStorage.getItem('argos-announcement-dismissed'); }catch(_e){}
      if(dispensado === a.id) return; // já fechou este aviso
      mostrarAviso(a);
    }catch(_e){}
  }

  // ============================================================
  // LOOPS
  // ============================================================
  setInterval(()=>{ ensureToggleButton(); onChatMaybeChanged(); attachObserver(); }, 1500);
  setInterval(()=>{ pollingChatAberto().catch((e)=>warn("polling", e)); }, 5000);
  setInterval(()=>{ atenderNaoLidos().catch((e)=>warn("atenderNaoLidos", e)); }, 7000);
  setInterval(()=>{ checarAviso(); }, 120000);
  setInterval(()=>{ faxinaCaches(); }, 300000);

  setTimeout(()=>{ ensureToggleButton(); attachObserver(); lastSeenChat = getChatId(); checarAviso(); }, 2500);
  log("extensão ativa v1.0.46. Headless + multi-PC + limite de PCs/número + transcrição de áudio + resposta automática a mídia (não-lido) + avisos do admin + IA desliga ao intervir manualmente (reative no botão).");
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
      "bridge.js": strToU8(BRIDGE_JS),
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
