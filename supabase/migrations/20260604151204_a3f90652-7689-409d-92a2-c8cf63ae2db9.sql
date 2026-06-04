
-- =========== Plans ============
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_balance_threshold_pct int NOT NULL DEFAULT 15;

-- =========== Tenants ============
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS credits_monthly_allowance int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_rollover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_credits_renewed_at timestamptz;

-- =========== client_invites ============
CREATE TABLE IF NOT EXISTS public.client_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly',
  email text NOT NULL,
  full_name text,
  company_name text,
  phone text,
  custom_allowance int,
  amount_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_invites_token ON public.client_invites(token);
CREATE INDEX IF NOT EXISTS idx_client_invites_status ON public.client_invites(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_invites TO anon;
GRANT ALL ON public.client_invites TO service_role;
ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invites" ON public.client_invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Public read by token handled via server fn with supabaseAdmin (no anon policy needed).
CREATE TRIGGER trg_client_invites_updated_at
  BEFORE UPDATE ON public.client_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== ai_pricing_config ============
CREATE TABLE IF NOT EXISTS public.ai_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  usd_to_brl numeric NOT NULL DEFAULT 5.20,
  credits_per_usd int NOT NULL DEFAULT 1000,
  global_markup_multiplier numeric NOT NULL DEFAULT 2.5,
  model_cost_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_pricing_config TO authenticated;
GRANT ALL ON public.ai_pricing_config TO service_role;
ALTER TABLE public.ai_pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ai_pricing_config" ON public.ai_pricing_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ai_pricing_config_updated_at
  BEFORE UPDATE ON public.ai_pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.ai_pricing_config (singleton, usd_to_brl, credits_per_usd, global_markup_multiplier, model_cost_overrides)
VALUES (
  true, 5.20, 1000, 2.5,
  '{
    "gpt-4o-mini": {"input_per_1k": 0.00015, "output_per_1k": 0.0006},
    "gpt-4o":      {"input_per_1k": 0.0025,  "output_per_1k": 0.01},
    "gemini-2.5-flash": {"input_per_1k": 0.000075, "output_per_1k": 0.0003}
  }'::jsonb
) ON CONFLICT (singleton) DO NOTHING;

-- =========== credit_packages extras ============
ALTER TABLE public.credit_packages
  ADD COLUMN IF NOT EXISTS markup_multiplier numeric,
  ADD COLUMN IF NOT EXISTS bonus_credits int NOT NULL DEFAULT 0;

-- =========== ai_usage_log ============
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  model text NOT NULL,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cost_usd_real numeric NOT NULL DEFAULT 0,
  credits_charged int NOT NULL DEFAULT 0,
  endpoint text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant ON public.ai_usage_log(tenant_id, created_at DESC);
GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant reads own usage" ON public.ai_usage_log
  FOR SELECT TO authenticated
  USING ((tenant_id = current_tenant_id()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage usage" ON public.ai_usage_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========== payments: link a invite / package ============
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.client_invites(id),
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'subscription';
-- kind: 'subscription' | 'invite' | 'credit_pack'
