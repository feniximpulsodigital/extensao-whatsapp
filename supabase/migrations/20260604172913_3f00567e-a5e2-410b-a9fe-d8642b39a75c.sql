
DROP POLICY IF EXISTS "Admins insert tenants" ON public.tenants;
CREATE POLICY "Admins insert tenants"
  ON public.tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;

CREATE POLICY "Admins insert app_settings"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update app_settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete app_settings"
  ON public.app_settings
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE SELECT (asaas_api_key_sandbox, asaas_api_key_production, asaas_webhook_token)
  ON public.app_settings FROM authenticated, anon;

REVOKE SELECT (extension_api_key) ON public.tenants FROM authenticated, anon;
