-- Rotina de manutenção: mantém o projeto Supabase ativo com uma verificação
-- leve a cada 5 dias (evita pausa automática por inatividade nos planos
-- gratuitos/free-tier). Histórico visível só para admins.
CREATE TABLE IF NOT EXISTS public.maintenance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ok', 'error')),
  detail text,
  tenants_count integer
);

ALTER TABLE public.maintenance_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read maintenance_runs"
  ON public.maintenance_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.maintenance_runs TO authenticated;
GRANT ALL ON public.maintenance_runs TO service_role;
