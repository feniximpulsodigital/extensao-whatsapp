-- Comunicados/avisos do admin para todos os clientes.
-- Mostrado no painel do cliente e na extensão (WhatsApp Web).
-- Regra de produto: um aviso ativo por vez (o mais recente com is_active).

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body TEXT NOT NULL,
  -- info | warning | critical → cor/ícone no banner
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_active_idx
  ON public.announcements (is_active, created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para qualquer usuário autenticado (todos os clientes veem).
-- A escrita é feita só pelo service role (server functions do admin).
CREATE POLICY "announcements_select_all" ON public.announcements
FOR SELECT TO authenticated
USING (true);

NOTIFY pgrst, 'reload schema';
