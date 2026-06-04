# ---------- Build stage ----------
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Public Supabase env vars baked at build time (passed via EasyPanel build args)
# Accept both plain names and Vite names so the self-hosted build is not tied to Lovable Cloud.
ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY
ARG SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY \
    SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}" \
    VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-$SUPABASE_PUBLISHABLE_KEY}" \
    VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-$SUPABASE_PROJECT_ID}" \
    bun run build

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Nitro node-server output is fully self-contained
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server/index.mjs"]
