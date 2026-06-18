import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Aviso ativo para a extensão (WhatsApp Web). Autenticado pela chave da
// extensão (mesma usada no ai-reply). Retorna o aviso ativo mais recente ou
// null. A extensão guarda o id já visto e só mostra de novo quando muda.
export const Route = createFileRoute("/api/public/announcement")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key") ?? "";
        if (!apiKey || apiKey.length < 16) return json(401, { error: "Missing x-api-key" });

        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id")
          .eq("extension_api_key", apiKey)
          .maybeSingle();
        if (!tenant) return json(401, { error: "Invalid api key" });

        const { data } = await supabaseAdmin
          .from("announcements")
          .select("id, title, body, level, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return json(200, { announcement: data ?? null });
      },
    },
  },
});
