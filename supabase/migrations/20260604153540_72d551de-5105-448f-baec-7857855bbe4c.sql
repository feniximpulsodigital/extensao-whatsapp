
CREATE TABLE IF NOT EXISTS public.ai_global_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  default_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  master_system_prompt text NOT NULL DEFAULT 'Você é um atendente virtual cordial, claro e profissional. Use a base de conhecimento fornecida quando disponível. Responda no idioma do cliente.',
  default_temperature numeric NOT NULL DEFAULT 0.7,
  default_max_tokens integer NOT NULL DEFAULT 500,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_global_config TO authenticated;
GRANT ALL ON public.ai_global_config TO service_role;

ALTER TABLE public.ai_global_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_global_config"
  ON public.ai_global_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read ai_global_config"
  ON public.ai_global_config FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_ai_global_config_updated_at
  BEFORE UPDATE ON public.ai_global_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_global_config (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;
