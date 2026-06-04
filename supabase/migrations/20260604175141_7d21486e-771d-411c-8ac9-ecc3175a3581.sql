
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS brand_name text NOT NULL DEFAULT 'Argos Zap',
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_accent_light text NOT NULL DEFAULT '#0F6E56',
  ADD COLUMN IF NOT EXISTS brand_accent_dark text NOT NULL DEFAULT '#39FF8A';

-- Permitir que qualquer visitante leia apenas os campos de branding (via server fn pública)
GRANT SELECT (id, brand_name, brand_logo_url, brand_accent_light, brand_accent_dark) ON public.app_settings TO anon, authenticated;

DROP POLICY IF EXISTS "Public reads branding" ON public.app_settings;
CREATE POLICY "Public reads branding" ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);
