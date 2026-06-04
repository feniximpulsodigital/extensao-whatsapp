
ALTER TABLE public.ai_global_config
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'groq',
  ADD COLUMN IF NOT EXISTS default_monthly_usd numeric NOT NULL DEFAULT 5;

ALTER TABLE public.ai_global_config ALTER COLUMN default_model SET DEFAULT 'llama-3.3-70b-versatile';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_global_config_provider_check') THEN
    ALTER TABLE public.ai_global_config
      ADD CONSTRAINT ai_global_config_provider_check
      CHECK (provider IN ('groq','openai','anthropic'));
  END IF;
END $$;

-- Restrict client reads to non-sensitive fields. Remove the broad authenticated SELECT.
DROP POLICY IF EXISTS "Authenticated read ai_global_config" ON public.ai_global_config;

DO $$
DECLARE
  v_credits int;
BEGIN
  SELECT (5 * credits_per_usd)::int INTO v_credits FROM public.ai_pricing_config LIMIT 1;
  IF v_credits IS NULL THEN v_credits := 5000; END IF;

  UPDATE public.tenants
  SET credits_monthly_allowance = GREATEST(credits_monthly_allowance, v_credits),
      credits_balance = GREATEST(credits_balance, v_credits);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
  v_tenant_id UUID;
  v_full_name TEXT;
  v_company TEXT;
  v_monthly_usd NUMERIC;
  v_credits_per_usd INT;
  v_default_credits INT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_company := COALESCE(NEW.raw_user_meta_data->>'company_name', v_full_name);
  v_is_admin := (lower(NEW.email) = 'contato@feniximpulsodigital.com.br');

  INSERT INTO public.profiles (id, full_name, company_name, phone, email)
  VALUES (NEW.id, v_full_name, v_company, NEW.raw_user_meta_data->>'phone', NEW.email);

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');

    SELECT default_monthly_usd INTO v_monthly_usd FROM public.ai_global_config LIMIT 1;
    SELECT credits_per_usd INTO v_credits_per_usd FROM public.ai_pricing_config LIMIT 1;
    v_default_credits := COALESCE(v_monthly_usd, 5) * COALESCE(v_credits_per_usd, 1000);

    INSERT INTO public.tenants (owner_id, company_name, status, credits_balance, credits_monthly_allowance, last_credits_renewed_at)
    VALUES (NEW.id, v_company, 'active', v_default_credits, v_default_credits, now())
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.ai_config (tenant_id) VALUES (v_tenant_id);
    INSERT INTO public.brand_config (tenant_id) VALUES (v_tenant_id);
    INSERT INTO public.system_prompts (tenant_id, name, content, is_default)
    VALUES (v_tenant_id, 'Atendimento padrão',
      'Você é um atendente cordial. Responda de forma clara, objetiva e profissional, usando a base de conhecimento fornecida.',
      TRUE);
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.ai_global_config SET provider = 'groq', default_model = 'llama-3.3-70b-versatile' WHERE provider IS NULL OR provider = 'lovable';
