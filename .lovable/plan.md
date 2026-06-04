
## O que vai ser feito

### 1. Tema Light/Dark com toggle (padrão: Light)

- Restaurar os tokens de tema **light** no `:root` do `src/styles.css` (fundo branco, texto escuro, accent verde dark `#0F6E56` para contraste em fundo claro — conforme brand guideline).
- Mover o tema **dark** (preto `#111` + verde neon `#39FF8A`) para o seletor `.dark`.
- Criar `ThemeProvider` em `src/components/theme-provider.tsx` que:
  - Lê preferência salva em `localStorage` (`argos-theme`).
  - Aplica classe `light` / `dark` no `<html>`.
  - Default: `light`.
- Adicionar `<ThemeProvider>` no `__root.tsx`.
- Criar componente `ThemeToggle` (botão Sol/Lua) e colocá-lo no header de:
  - Landing (`/`)
  - Dashboard (`/dashboard`)
  - Admin (`/admin/*`)

### 2. Página admin para configurar visual

- Nova rota: `src/routes/_authenticated/admin.branding.tsx` (aba "Visual").
- Adicionar item "Visual" na nav lateral do admin.
- Campos configuráveis:
  - **Cor de accent (light)** — color picker, default `#0F6E56`
  - **Cor de accent (dark)** — color picker, default `#39FF8A`
  - **Logo personalizado** (URL ou upload simples — campo de URL por simplicidade)
  - **Nome da marca** — default "Argos Zap"
- Persistência: extender a tabela `app_settings` com 4 colunas novas via migração:
  - `brand_name text`, `brand_logo_url text`, `brand_accent_light text`, `brand_accent_dark text`.
- Server functions:
  - Estender `getAppSettings` / `updateAppSettings` em `src/lib/billing.functions.ts` para incluir esses campos.
  - Nova server fn pública `getPublicBranding` (sem auth) para o site/landing carregar os overrides.
- Aplicação dos overrides:
  - `ThemeProvider` busca branding público no mount e injeta as cores como variáveis CSS inline no `<html>` (`--accent`, `--primary`, `--ring`).
  - `Logo.tsx` aceita override de URL/nome via hook que lê o branding.

### 3. Detalhes de implementação

- Conversão hex→oklch feita inline com `color-mix` ou aplicando hex direto em `--accent` (já que oklch e hex coexistem nos tokens — o token vira o valor literal).
- Manter brand guideline: verde neon SÓ no tema dark (como accent), verde dark `#0F6E56` no light.
- Toggle persiste imediato; troca sem reload.
- Se o admin não configurar nada, valores default das guidelines são usados.

### Arquivos afetados

```
NOVO  src/components/theme-provider.tsx
NOVO  src/components/theme-toggle.tsx
NOVO  src/routes/_authenticated/admin.branding.tsx
NOVO  supabase/migrations/<ts>_branding_settings.sql
EDIT  src/styles.css                       (restaurar light, mover dark)
EDIT  src/routes/__root.tsx                (envolver com ThemeProvider)
EDIT  src/routes/index.tsx                 (header: toggle)
EDIT  src/routes/login.tsx                 (header: toggle opcional)
EDIT  src/routes/_authenticated/dashboard.tsx (header: toggle)
EDIT  src/routes/_authenticated/admin.tsx  (nav: aba Visual + toggle)
EDIT  src/components/brand/Logo.tsx        (suporta override de URL/nome)
EDIT  src/lib/billing.functions.ts         (campos novos no get/update settings)
```

Posso prosseguir?
