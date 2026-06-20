import { createFileRoute } from "@tanstack/react-router";
import { EXTENSION_VERSION } from "@/lib/extension-version";

// Endpoint público para confirmar a versão da extensão que ESTE servidor
// gera — útil para checar, após o deploy, se o build já está no ar.
export const Route = createFileRoute("/api/public/extension-version")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ version: EXTENSION_VERSION }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
