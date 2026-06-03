
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'client');
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'cancelled', 'trial');
CREATE TYPE public.transaction_type AS ENUM ('purchase', 'consumption', 'bonus', 'refund', 'adjustment');
CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'failed');

-- =========================================================
-- updated_at helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (separate table — never store role on profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursion in policies
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================================
-- PLANS (subscription plans)
-- =========================================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  max_knowledge_entries INTEGER NOT NULL DEFAULT 100,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are publicly readable"
ON public.plans FOR SELECT
USING (true);

CREATE POLICY "Admins manage plans"
ON public.plans FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- CREDIT PACKAGES (one-off credit purchases)
-- =========================================================
CREATE TABLE public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_packages TO anon, authenticated;
GRANT ALL ON public.credit_packages TO service_role;

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Packages are publicly readable"
ON public.credit_packages FOR SELECT
USING (true);

CREATE POLICY "Admins manage packages"
ON public.credit_packages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_credit_packages_updated_at
BEFORE UPDATE ON public.credit_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- TENANTS (client companies)
-- =========================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  document TEXT,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  status public.tenant_status NOT NULL DEFAULT 'trial',
  credits_balance INTEGER NOT NULL DEFAULT 0,
  extension_api_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  subscription_started_at TIMESTAMPTZ,
  subscription_renews_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners update own tenant"
ON public.tenants FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert tenants"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid());

CREATE POLICY "Admins delete tenants"
ON public.tenants FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: get current user's tenant id
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.tenants WHERE owner_id = auth.uid() LIMIT 1
$$;

-- =========================================================
-- CREDIT TRANSACTIONS
-- =========================================================
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant reads own transactions"
ON public.credit_transactions FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins insert transactions"
ON public.credit_transactions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_credit_tx_tenant ON public.credit_transactions(tenant_id, created_at DESC);

-- =========================================================
-- PAYMENTS
-- =========================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asaas_payment_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  description TEXT,
  billing_type TEXT,
  invoice_url TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant reads own payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins manage payments"
ON public.payments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- KNOWLEDGE BASE
-- =========================================================
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO service_role;

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own knowledge"
ON public.knowledge_base FOR ALL
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  tenant_id = public.current_tenant_id()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_kb_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- AI CONFIG
-- =========================================================
CREATE TABLE public.ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 500,
  response_delay_ms INTEGER NOT NULL DEFAULT 1500,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_config TO authenticated;
GRANT ALL ON public.ai_config TO service_role;

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own ai_config"
ON public.ai_config FOR ALL
TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_config_updated_at
BEFORE UPDATE ON public.ai_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- BRAND CONFIG (per-tenant extension branding)
-- =========================================================
CREATE TABLE public.brand_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT 'Argos',
  primary_color TEXT NOT NULL DEFAULT '#7C3AED',
  secondary_color TEXT NOT NULL DEFAULT '#0F172A',
  logo_url TEXT,
  icon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_config TO authenticated;
GRANT ALL ON public.brand_config TO service_role;

ALTER TABLE public.brand_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own brand"
ON public.brand_config FOR ALL
TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_brand_updated_at
BEFORE UPDATE ON public.brand_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SYSTEM PROMPTS
-- =========================================================
CREATE TABLE public.system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_prompts TO authenticated;
GRANT ALL ON public.system_prompts TO service_role;

ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own prompts"
ON public.system_prompts FOR ALL
TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_sysprompts_updated_at
BEFORE UPDATE ON public.system_prompts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER_ROLES policies (after has_role exists)
-- =========================================================
CREATE POLICY "Users read own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- AUTO-CREATE profile, role, tenant on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    VALUES (NEW.id, v_company, 'trial', 50)
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
    INSERT INTO public.credit_transactions (tenant_id, type, amount, balance_after, description)
    VALUES (v_tenant_id, 'bonus', 50, 50, 'Créditos de boas-vindas (trial)');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- SEED: plans + credit packages
-- =========================================================
INSERT INTO public.plans (name, description, price_cents, monthly_credits, max_knowledge_entries, features, sort_order)
VALUES
  ('Starter', 'Ideal para começar com automações no WhatsApp', 9700, 1000, 100,
   '["1 número WhatsApp","Base de conhecimento até 100 entradas","Suporte por e-mail"]'::jsonb, 1),
  ('Pro', 'Para empresas com alto volume de atendimento', 29700, 5000, 1000,
   '["Múltiplos números","Base ilimitada","Suporte prioritário","Customização da extensão"]'::jsonb, 2);

INSERT INTO public.credit_packages (name, description, credits, price_cents, sort_order)
VALUES
  ('Pacote 500', '500 créditos avulsos', 500, 4700, 1),
  ('Pacote 2.000', '2.000 créditos avulsos', 2000, 16700, 2),
  ('Pacote 10.000', '10.000 créditos avulsos com bônus', 10000, 69700, 3);
