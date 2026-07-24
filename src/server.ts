import "./lib/error-capture";

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { startDbKeepAliveScheduler } from "./lib/maintenance-scheduler.server";

// Roda uma única vez quando o processo Node sobe (não a cada request).
// Mantém o Supabase ativo mesmo que o site fique sem tráfego por dias.
startDbKeepAliveScheduler();

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Cabeçalhos de segurança aplicados a todas as respostas. Mitigam clickjacking
// (frame-ancestors/X-Frame-Options), sniffing de MIME, vazamento de referrer e
// forçam HTTPS (HSTS). Mantemos a CSP pragmática: não restringimos script-src
// inline porque o SSR/hydration do framework injeta scripts inline — uma CSP
// rígida demais quebraria o app. O foco aqui é impedir que a página seja
// embutida em iframe malicioso (ex.: phishing na tela de pagamento).
function applySecurityHeaders(response: Response): Response {
  const h = response.headers;
  if (!h.has("X-Content-Type-Options")) h.set("X-Content-Type-Options", "nosniff");
  if (!h.has("X-Frame-Options")) h.set("X-Frame-Options", "DENY");
  if (!h.has("Referrer-Policy")) h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!h.has("Strict-Transport-Security")) {
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (!h.has("Content-Security-Policy")) {
    h.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  if (!h.has("Permissions-Policy")) {
    h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  }
  return response;
}

export default createServerEntry({
  async fetch(request) {
    try {
      const response = await handler.fetch(request);
      return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
});
