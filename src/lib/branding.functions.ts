import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULTS = {
  brandName: "Argos Zap",
  brandLogoUrl: null as string | null,
  accentLight: "#0F6E56",
  accentDark: "#39FF8A",
};

// Public — anyone can read branding (used by ThemeProvider on every page)
export const getPublicBranding = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("brand_name, brand_logo_url, brand_accent_light, brand_accent_dark")
    .limit(1)
    .maybeSingle();
  return {
    brandName: data?.brand_name || DEFAULTS.brandName,
    brandLogoUrl: data?.brand_logo_url || DEFAULTS.brandLogoUrl,
    accentLight: data?.brand_accent_light || DEFAULTS.accentLight,
    accentDark: data?.brand_accent_dark || DEFAULTS.accentDark,
  };
});

// Admin — full read/write for the branding admin page
async function adminGuard(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado");
}

export const getBrandingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("id, brand_name, brand_logo_url, brand_accent_light, brand_accent_dark")
      .limit(1)
      .maybeSingle();
    return {
      brandName: data?.brand_name || DEFAULTS.brandName,
      brandLogoUrl: data?.brand_logo_url || "",
      accentLight: data?.brand_accent_light || DEFAULTS.accentLight,
      accentDark: data?.brand_accent_dark || DEFAULTS.accentDark,
    };
  });

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use formato #RRGGBB");

export const updateBrandingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        brandName: z.string().min(1).max(64),
        brandLogoUrl: z.string().url().or(z.literal("")).nullable(),
        accentLight: hex,
        accentDark: hex,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await adminGuard(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = {
      brand_name: data.brandName,
      brand_logo_url: data.brandLogoUrl || null,
      brand_accent_light: data.accentLight,
      brand_accent_dark: data.accentDark,
    };
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin.from("app_settings").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("app_settings").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
