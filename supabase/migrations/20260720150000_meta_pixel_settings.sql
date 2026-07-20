-- Meta Pixel + Conversions API: id do pixel é público (vai para o
-- navegador), token de acesso é sensível (só o servidor lê).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS meta_pixel_id text,
  ADD COLUMN IF NOT EXISTS meta_capi_access_token text,
  ADD COLUMN IF NOT EXISTS meta_test_event_code text;

GRANT SELECT (meta_pixel_id) ON public.app_settings TO anon, authenticated;

REVOKE SELECT (meta_capi_access_token, meta_test_event_code)
  ON public.app_settings FROM authenticated, anon;
