
# Plano: Clientes, planos custom múltiplos com link de pagamento e créditos de IA com markup

## 1. Schema (migrations)

### `plans` — novos campos
- `is_custom boolean default false` — oculta da página pública; aparece só no admin.
- `low_balance_threshold_pct int default 15`.
- (já existe `price_cents` e `price_cents_annual`; em plano custom podem ser 0 = grátis, ou qualquer valor = cobrado).

Admin poderá criar **vários** planos custom (mensal e/ou anual, com ou sem cobrança), cada um com seus próprios créditos, limites e descrição.

### `tenants` — novos campos
- `credits_monthly_allowance int default 0` — sobrescreve o do plano quando setado manualmente.
- `credits_rollover boolean default false`.
- `custom_plan_expires_at timestamptz` (opcional).
- `created_by_admin boolean default false`.

### `client_invites` (nova)
Link único para o cliente acessar, criar senha e (se houver preço) pagar:
- `id, token (único, indexado), tenant_id, plan_id, billing_cycle ('monthly'|'annual'|'free'), email, full_name, company_name, phone, status ('pending'|'accepted'|'paid'|'expired'), expires_at, created_at, accepted_at`.
- URL pública: `/invite/{token}`.

### `ai_pricing_config` (singleton)
- `usd_to_brl numeric`, `credits_per_usd int default 1000`, `global_markup_multiplier numeric default 2.5`, `model_cost_overrides jsonb`.

### `credit_packages` — novos campos
- `markup_multiplier numeric` (sobrescreve global), `bonus_credits int default 0`.

### `ai_usage_log` (nova)
- `tenant_id, model, input_tokens, output_tokens, cost_usd_real, credits_charged, endpoint, created_at`.

### `credit_transactions` — já existe, reaproveitado.

## 2. Backend

### `src/lib/admin-users.functions.ts`
- `adminCreateInvite({ email, fullName, companyName, phone, planId, billingCycle, customAllowance?, expiresInDays })`:
  1. Cria `tenants` com `status='pending_payment'` (ou `'pending_activation'` se plano grátis), aplica `plan_id`, `credits_monthly_allowance` customizado.
  2. Cria `client_invites` com token aleatório.
  3. Retorna URL `https://<host>/invite/{token}` para o admin copiar/enviar.
- `adminListInvites()`, `adminRevokeInvite({ id })`, `adminResendInvite({ id })` (gera novo token e expiração).
- `adminCreateClientDirect({...})` — alternativa: cria usuário+tenant direto via `supabaseAdmin.auth.admin.createUser` (sem link), para casos em que o admin já tem a senha.
- `adminUpdateTenant({...})`, `adminAddCredits({...})`, `adminResetPassword({...})`.

### `src/lib/invites.functions.ts` (público, sem auth)
- `getInviteByToken({ token })` — retorna dados do plano + valor a pagar (ou "grátis"), sem expor dados sensíveis.
- `acceptInvite({ token, password })` — cria `auth.users` via `supabaseAdmin`, vincula ao `tenant.owner_id`, marca invite como `accepted`. Se plano grátis: ativa tenant. Se pago: redireciona pro checkout do invite.
- `createInvitePayment({ token, billingType: 'PIX'|'CARD', cardData? })` — gera cobrança Asaas atrelada ao tenant do invite; ao confirmar via webhook, ativa o tenant.

### `src/lib/ai-credits.functions.ts`
- `getMyCreditsSummary()` — `{ balance, monthly_allowance, low_balance, pct_remaining }` (créditos abstratos, nenhuma menção a USD/tokens/markup).
- `chargeAiUsage({ model, inputTokens, outputTokens, endpoint })` — calcula custo real, converte via `credits_per_usd`, debita, registra em `ai_usage_log`; erro `INSUFFICIENT_CREDITS` se saldo insuficiente.
- `listCreditPackages()` — pública para autenticados, mostra apenas créditos+preço.
- `buyCreditPackage({ packageId, billingType })` — cobrança Asaas; webhook credita ao confirmar.

### `src/lib/admin-pricing.functions.ts`
- CRUD `ai_pricing_config`, `credit_packages`.
- `adminListAiUsage({ tenantId?, from, to })` — relatório custo real × cobrado × margem.

### Webhook `asaas-webhook.ts` — estender
- Diferenciar 3 origens via `externalReference`/colunas em `payments`:
  1. Assinatura recorrente de plano (já existe).
  2. Pagamento de invite (novo) → ativa tenant + cria assinatura se aplicável.
  3. Compra avulsa de pacote de créditos (novo) → credita `credits + bonus_credits`.

### Renovação mensal de créditos
- Server route `/api/public/cron-credits-renew` (chamado por pg_cron) → para cada tenant ativo, repõe `credits_balance` para `credits_monthly_allowance` (ou soma se `rollover`).

## 3. Frontend

### Cliente
- **Dashboard**: card "Créditos restantes" com barra de progresso, badge "Saldo baixo" quando ≤15%, botão "Comprar créditos".
- **Rota `/buy-credits`**: lista pacotes (nome, créditos+bônus, preço R$), checkout PIX/cartão.
- Banner persistente quando saldo ≤ threshold.
- **Nenhuma exposição de USD, tokens, modelo ou custo.**

### Página pública de convite — `src/routes/invite.$token.tsx`
- Sem auth. Mostra: nome do plano, créditos/mês, valor (ou "Cortesia"), formulário para criar senha.
- Se plano grátis → cria conta → login automático → `/dashboard`.
- Se plano pago → cria conta → tela de checkout (PIX/cartão) reaproveitando UI atual → polling/webhook → `/dashboard`.
- Tratamento de token expirado/revogado/já usado.

### Admin (`/admin`)
- **Aba "Clientes"** (atual + extensões):
  - Botão "Criar convite" → modal: dados do cliente + plano (lista todos, incluindo custom) + ciclo + allowance opcional + validade do link. Ao salvar, exibe URL para copiar.
  - Alternativa "Criar conta direto" (com senha definida pelo admin).
  - Ações por linha do tenant: editar, ajustar créditos, resetar senha, ver uso, ver pagamentos.
- **Aba "Convites"** (nova): lista invites pendentes/aceitos/expirados, copiar link, reenviar, revogar.
- **Aba "Planos"**: checkbox "Plano custom (não listado publicamente)". Pode ter qualquer preço (incluindo 0). Admin pode criar quantos quiser.
- **Aba "Créditos de IA"** (nova):
  - Config `ai_pricing_config` (USD→BRL, créditos por USD, markup global, custos por modelo).
  - CRUD `credit_packages` com preview: "custo real R$ X · venda R$ Y · margem Z%".
- **Aba "Uso & Margem"** (nova): relatório por tenant com custo real vs. cobrado.

### Checkout público
- `listActivePlans` filtra `is_custom = false`.

## 4. Integração de consumo de IA
Envolver toda chamada de IA do app com `chargeAiUsage` (antes ou depois conforme padrão escolhido). Se ainda não há chamadas implementadas, deixar helper pronto + doc.

## 5. Ordem de implementação
1. Migration (schema + seed `ai_pricing_config`).
2. Server fns admin: planos custom, criar invite, criar conta direta, editar tenant, adicionar créditos.
3. UI admin: aba Clientes (criar convite + criar direto), aba Convites, ajustes em Planos.
4. Página pública `/invite/{token}` + server fns públicas + checkout do invite.
5. Webhook estendido (invite + pacote de créditos).
6. Server fns + UI de créditos do cliente (saldo, alerta, compra).
7. Admin: pricing config + CRUD pacotes + relatório de margem.
8. Cron de renovação mensal.

## Pontos a confirmar na build
- Provedor(es) de IA usados hoje para calibrar `model_cost_overrides`.
- Validade padrão do link de convite (sugestão: 7 dias).
- Se tenants em plano custom também podem comprar pacotes avulsos (assumindo que sim).
