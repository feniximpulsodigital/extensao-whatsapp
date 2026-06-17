-- Pedido de reembolso (garantia) como categoria de ticket de suporte.
-- Reaproveita toda a infra de tickets (thread, leitura, prioridade) e
-- adiciona uma etiqueta para o admin filtrar e contatar quem pediu reembolso.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'support'
  CHECK (category IN ('support', 'refund'));

COMMENT ON COLUMN public.support_tickets.category IS
  'support = chamado comum | refund = solicitação de reembolso (garantia).';

CREATE INDEX IF NOT EXISTS support_tickets_category_idx
  ON public.support_tickets (category, status, created_at);

NOTIFY pgrst, 'reload schema';
