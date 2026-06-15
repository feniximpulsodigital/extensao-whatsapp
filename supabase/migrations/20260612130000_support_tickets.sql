-- Suporte por tickets com prioridade por plano

-- Prioridade de atendimento do plano: maior = atendido primeiro na fila
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS support_priority INTEGER NOT NULL DEFAULT 1;
COMMENT ON COLUMN public.plans.support_priority IS 'Prioridade de suporte (maior = responde primeiro). Snapshot copiado para o ticket na abertura.';
UPDATE public.plans SET support_priority = 2 WHERE lower(name) = 'pro';

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  -- open = aguardando admin | answered = aguardando cliente | closed = encerrado
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('client', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS support_tickets_tenant_idx ON public.support_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets (status, priority DESC, last_message_at);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages (ticket_id, created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Escrita pelo service role (server functions); leitura para dono e admin
CREATE POLICY "support_tickets_select_own" ON public.support_tickets
FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "support_messages_select_own" ON public.support_messages
FOR SELECT TO authenticated
USING (
  ticket_id IN (
    SELECT t.id FROM public.support_tickets t
    WHERE t.tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);
