# Plano: Checkout obrigatório com Asaas

## Fluxo
1. Cliente se cadastra → tenant criado com `status='pending_payment'`, 0 créditos
2. Login redireciona automaticamente para `/checkout` enquanto status ≠ `active`
3. `/checkout` é a única rota acessível: escolhe plano (mensal/anual) → escolhe PIX ou cartão recorrente → paga
4. Webhook Asaas confirma pagamento → ativa tenant + credita

## Mudanças no banco (migration)
- `tenant_status`: adicionar valor `'pending_payment'`
- `plans`: adicionar `billing_cycle text` ('monthly'|'annual'), `price_cents_annual int`, `asaas_plan_ref text`
- `tenants`: adicionar `asaas_customer_id text`, `asaas_subscription_id text`, `billing_cycle text`
- `payments`: adicionar `billing_cycle text`, `pix_qr_code text`, `pix_copy_paste text`
- Atualizar `handle_new_user()`: tenant criado com `status='pending_payment'`, `credits_balance=0`, sem créditos bônus, sem transação de boas-vindas

## Secret
- `ASAAS_API_KEY` (você cola a chave do painel Asaas — produção ou sandbox)
- `ASAAS_WEBHOOK_TOKEN` (token que você define no painel Asaas → Webhooks para validar assinatura)

## Server functions (TanStack `createServerFn`)
Arquivo `src/lib/billing.functions.ts`:
- `getMyTenantStatus()` — retorna status + plan atual (gate do front)
- `listAvailablePlans()` — lista planos ativos
- `createAsaasCustomer()` — cria customer no Asaas se não existir, salva `asaas_customer_id`
- `createPixCharge({ planId, billingCycle })` — cria cobrança PIX única (mensal ou anual), retorna QR code + copia-cola
- `createCardSubscription({ planId, billingCycle, cardToken })` — cria assinatura recorrente cartão (mensal/anual)
- `checkPaymentStatus({ paymentId })` — polling enquanto cliente vê QR PIX

## Webhook
`src/routes/api/public/asaas-webhook.ts`:
- Valida header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` → marca payment como pago, ativa tenant (`status='active'`), credita `monthly_credits` do plano, cria `credit_transaction`
- `SUBSCRIPTION_*` → atualiza `subscription_renews_at`

## UI
- `src/routes/_authenticated/checkout.tsx` — tela cheia com cards de planos (toggle Mensal/Anual), seleção, modal PIX (QR + copia-cola + polling) ou form cartão (tokenização Asaas)
- Layout `_authenticated/route.tsx`: se `status !== 'active'` e rota ≠ `/checkout` → `redirect('/checkout')`
- Após confirmação → redireciona `/dashboard`

## Admin
- Tela de planos no admin (já existe `plans` table) ganha campos: cycle, preço anual

## Pontos técnicos
- Asaas API: `https://api.asaas.com/v3` (prod) ou `https://api-sandbox.asaas.com/v3` (sandbox). Header `access_token`.
- Tokenização de cartão: usa endpoint `/creditCard/tokenize` do Asaas (PCI-safe, número do cartão nunca toca nosso servidor — front envia direto pro Asaas, recebe token, manda token pro nosso server)
- Assinatura recorrente: `POST /subscriptions` com `cycle: MONTHLY` ou `YEARLY`
- PIX único: `POST /payments` com `billingType: PIX` → depois `GET /payments/{id}/pixQrCode`

Pronto pra começar? Vou criar a migration primeiro; depois você cola a `ASAAS_API_KEY` (sandbox tá ok pra começar) e eu sigo com server functions + UI.