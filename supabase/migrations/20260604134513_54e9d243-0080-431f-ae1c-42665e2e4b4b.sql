
-- Add pending_payment status
ALTER TYPE public.tenant_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- Plans: billing cycle + annual price + asaas ref
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_cents_annual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asaas_plan_ref text;

-- Tenants: asaas customer + subscription + cycle
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_cycle text;

-- Payments: cycle + PIX info
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_copy_paste text;

-- Update handle_new_user: no trial, no welcome credits, status pending_payment
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
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_company := COALESCE(NEW.raw_user_meta_data->>'company_name', v_full_name);
  v_is_admin := (lower(NEW.email) = 'contato@feniximpulsodigital.com.br');

  INSERT INTO public.profiles (id, full_name, company_name, phone, email)
  VALUES (
    NEW.id,
    v_full_name,
    v_company,
    NEW.raw_user_meta_data->>'phone',
    NEW.email
  );

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');

    INSERT INTO public.tenants (owner_id, company_name, status, credits_balance)
    VALUES (NEW.id, v_company, 'pending_payment', 0)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.ai_config (tenant_id) VALUES (v_tenant_id);
    INSERT INTO public.brand_config (tenant_id) VALUES (v_tenant_id);
    INSERT INTO public.system_prompts (tenant_id, name, content, is_default)
    VALUES (
      v_tenant_id,
      'Atendimento padrão',
      'Você é um atendente cordial. Responda de forma clara, objetiva e profissional, usando a base de conhecimento fornecida.',
      TRUE
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
