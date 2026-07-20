import { createHash } from "node:crypto";

// Server-only: envia eventos para a Meta Conversions API. Nunca importar
// este arquivo de código que roda no navegador — usa node:crypto e o
// access token fica só aqui.

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

type CapiEvent = {
  eventName: "Purchase" | "Lead" | "InitiateCheckout" | "CompleteRegistration";
  email?: string | null;
  phone?: string | null;
  valueCents?: number;
  currency?: string;
  eventSourceUrl?: string;
  eventId?: string;
};

// Envia um evento server-side para a Meta Conversions API. Silencioso em
// caso de erro/config ausente — rastreamento de anúncio nunca deve
// derrubar um fluxo de negócio (pagamento, cadastro, etc).
export async function sendMetaCapiEvent(event: CapiEvent): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("meta_pixel_id, meta_capi_access_token, meta_test_event_code")
      .limit(1)
      .maybeSingle();

    const pixelId = settings?.meta_pixel_id;
    const accessToken = settings?.meta_capi_access_token;
    if (!pixelId || !accessToken) return;

    const userData: Record<string, string[]> = {};
    if (event.email) userData.em = [sha256(event.email)];
    if (event.phone) userData.ph = [sha256(event.phone.replace(/\D/g, ""))];

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: event.eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: event.eventSourceUrl,
          event_id: event.eventId,
          user_data: userData,
          custom_data:
            event.valueCents !== undefined
              ? { currency: event.currency ?? "BRL", value: (event.valueCents / 100).toFixed(2) }
              : undefined,
        },
      ],
    };
    if (settings?.meta_test_event_code) {
      payload.test_event_code = settings.meta_test_event_code;
    }

    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[meta-capi] ${event.eventName} falhou: ${resp.status} ${body}`);
    }
  } catch (err) {
    console.error("[meta-capi] erro ao enviar evento", err);
  }
}
