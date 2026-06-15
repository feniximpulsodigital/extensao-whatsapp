-- Limite de computadores por plano (janela deslizante) + número de WhatsApp vinculado ao tenant

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_devices INTEGER;
COMMENT ON COLUMN public.plans.max_devices IS 'Máximo de computadores ativos ao mesmo tempo (janela deslizante). NULL = ilimitado.';

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
COMMENT ON COLUMN public.tenants.whatsapp_number IS 'Número de WhatsApp autorizado (somente dígitos, com DDI). Cadastrado pelo cliente no dashboard; a IA só responde nesse número.';

-- Starter: 1 computador por vez
UPDATE public.plans SET max_devices = 1 WHERE lower(name) = 'starter';

-- Dispositivos vistos por tenant (a extensão envia deviceId em cada chamada)
CREATE TABLE IF NOT EXISTS public.tenant_devices (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, device_id)
);

ALTER TABLE public.tenant_devices ENABLE ROW LEVEL SECURITY;

-- Escrita só pelo service role (endpoint da extensão); dono e admin podem consultar
CREATE POLICY "tenant_devices_select_own" ON public.tenant_devices
FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
