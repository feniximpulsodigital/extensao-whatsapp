-- Downgrade agendado: o cliente escolhe um plano menor que só passa a valer
-- na próxima renovação. O upgrade é imediato (via cobrança) e não usa isto.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pending_plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.tenants.pending_plan_id IS 'Plano agendado para a próxima renovação (downgrade). Aplicado pelo cron de renovação e então zerado.';
