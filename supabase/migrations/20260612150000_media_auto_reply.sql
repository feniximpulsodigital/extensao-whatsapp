-- Respostas automáticas para mídia que a IA não interpreta (imagem/documento/vídeo).
-- Quando a última mensagem do cliente é desse tipo, a IA envia o texto fixo
-- cadastrado e a extensão deixa o chat marcado como NÃO LIDO para o dono ver.
-- Áudio NÃO entra aqui: continua sendo transcrito normalmente.

ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS media_reply_image TEXT NOT NULL DEFAULT 'Recebi sua imagem! 👀 Já vou verificar e te respondo em instantes.',
  ADD COLUMN IF NOT EXISTS media_reply_document TEXT NOT NULL DEFAULT 'Recebi seu documento! 📄 Vou analisar e já te retorno.',
  ADD COLUMN IF NOT EXISTS media_reply_video TEXT NOT NULL DEFAULT 'Recebi seu vídeo! 🎥 Já vou assistir e te respondo em seguida.';
