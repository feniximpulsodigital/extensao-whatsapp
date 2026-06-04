# Deploy no EasyPanel via GitHub

Stack: TanStack Start (Vite + Nitro `node-server`) servido por Node 22.

## 1. Pré-requisitos
- Projeto Supabase pronto (URLs e chaves em mãos).
- Conta EasyPanel com acesso ao repositório GitHub.

## 2. Conectar GitHub
1. Suba este projeto para um repositório GitHub.
2. Garanta que `Dockerfile`, `.dockerignore` e `.env.example` foram commitados.

## 3. Criar o app no EasyPanel
1. **+ Create Service → App**.
2. **Source**: GitHub → escolha o repo e a branch (`main`).
3. **Build**: deixe `Dockerfile` (auto-detectado).
4. **Build Arguments** (necessários para o frontend funcionar):
   - `SUPABASE_URL` ou `VITE_SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_PROJECT_ID` ou `VITE_SUPABASE_PROJECT_ID`
5. **Environment Variables** (runtime — servidor):
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (service_role, mantenha secreta)
   - `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (o que for usar)
   - `ASAAS_API_KEY_PRODUCTION`, `ASAAS_WEBHOOK_TOKEN` (se for cobrar)
   - `NODE_ENV=production`, `PORT=3000`, `HOST=0.0.0.0`
6. **Ports**: exponha `3000` (HTTP).
7. **Domains**: aponte seu domínio e ative HTTPS (Let's Encrypt do EasyPanel).
8. Deploy.

## 4. Pós-deploy
- **Supabase → Auth → URL Configuration**: adicione seu domínio em **Site URL** e em **Redirect URLs** (`https://seu-dominio/**`).
- **Webhooks (Asaas, etc.)**: aponte para `https://seu-dominio/api/public/<rota>`.
- Faça login com o e-mail admin (`contato@feniximpulsodigital.com.br`) para liberar o painel `/admin`.

## 5. Atualizações
Cada push na branch configurada dispara rebuild automático no EasyPanel.

## 6. Build local (opcional)
```bash
bun install
bun run build
node dist/server/index.mjs
```

## Troubleshooting
- **Tela em branco no frontend/login**: faltou `SUPABASE_URL` e/ou `SUPABASE_PUBLISHABLE_KEY` nos Build Arguments — elas precisam estar no momento do `bun run build`, não só em runtime.
- **401 nas server functions de IA/pagamento**: faltou `SUPABASE_SERVICE_ROLE_KEY` ou a chave do provedor no runtime env.
- **OAuth/login redireciona errado**: ajuste Site URL/Redirect URLs no Supabase.
