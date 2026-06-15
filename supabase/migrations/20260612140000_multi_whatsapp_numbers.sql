-- Múltiplos números de WhatsApp por tenant, com limite por plano

-- Quantos números o plano permite cadastrar. NULL = ilimitado.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_numbers INTEGER;
COMMENT ON COLUMN public.plans.max_numbers IS 'Máximo de números de WhatsApp cadastráveis. NULL = ilimitado.';
UPDATE public.plans SET max_numbers = 1 WHERE lower(name) = 'starter';

-- Lista de números autorizados (somente dígitos, com DDI). Substitui o
-- campo único tenants.whatsapp_number, que fica como legado.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_numbers TEXT[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.tenants.whatsapp_numbers IS 'Números de WhatsApp autorizados (dígitos com DDI). A IA só responde nesses números.';

-- migra o número já cadastrado para a lista
UPDATE public.tenants
SET whatsapp_numbers = ARRAY[whatsapp_number]
WHERE whatsapp_number IS NOT NULL
  AND whatsapp_number <> ''
  AND whatsapp_numbers = '{}';
