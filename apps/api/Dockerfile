# Stage 1: Build & Deploy Isolation
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

# Copy monorepo manifests and contracts
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/contracts ./packages/contracts
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY apps/api ./apps/api

# Install dependencies and build
# pnpm (10.x, this lockfile) skips the Linux native packages under vite 8 -
# @esbuild/linux-x64 for esbuild 0.27/0.28 and @rolldown/binding-linux-x64-*
# - so esbuild's postinstall and `vite build` fail. --force installs every
# optional platform package, the native ones for this image included.
RUN pnpm install --frozen-lockfile --force
RUN pnpm --filter api build

# Isolate production dependencies
# --ignore-scripts: no runtime dependency needs one, and the esbuild that
# better-auth's optional peers drag in would fail its postinstall as above.
RUN pnpm --filter=api --prod --legacy deploy --ignore-scripts /app/pruned
RUN cp -r /app/apps/api/dist /app/pruned/dist
RUN cp -r /app/apps/api/drizzle /app/pruned/drizzle 2>/dev/null || true

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

COPY --from=builder --chown=fastify:nodejs /app/pruned ./

# Ensure local storage fallback directory exists with proper permissions
RUN mkdir -p storage && chown -R fastify:nodejs storage

USER fastify

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/health || exit 1

CMD ["node", "dist/index.js"]
