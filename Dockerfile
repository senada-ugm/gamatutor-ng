# Single-container build: Fastify serves the API (/api/v1, /api/auth, /docs)
# AND the built React SPA from one process on one port.

# Stage 1: build SPA + API
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/contracts ./packages/contracts
COPY packages/ui ./packages/ui
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY apps/app ./apps/app
COPY apps/api ./apps/api

# --force: see apps/api/Dockerfile for why native optional packages are needed.
RUN pnpm install --frozen-lockfile --force

# Empty VITE_API_URL = same origin; the SPA calls /api/v1/* and /api/auth/* on
# whatever host serves it, so one image works on any domain.
ENV VITE_API_URL=""
RUN pnpm --filter app build
RUN pnpm --filter api build

RUN pnpm --filter=api --prod --legacy deploy --ignore-scripts /app/pruned
RUN cp -r /app/apps/api/dist /app/pruned/dist
# seed.ts (bundled into dist, run by /v1/dev/reset-seed) reads its deck next to itself.
RUN cp -r /app/apps/api/src/db/seed-data /app/pruned/dist/seed-data
RUN cp -r /app/apps/api/drizzle /app/pruned/drizzle 2>/dev/null || true
RUN cp -r /app/apps/app/dist /app/pruned/public

# Stage 2: runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0
ENV WEB_DIST_DIR=/app/public

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

COPY --from=builder --chown=fastify:nodejs /app/pruned ./

RUN mkdir -p storage && chown -R fastify:nodejs storage

USER fastify

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/health || exit 1

CMD ["node", "dist/index.js"]
