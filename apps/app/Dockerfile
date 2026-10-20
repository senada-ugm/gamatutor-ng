# Stage 1: Build SPA assets
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

# Copy monorepo manifests and workspaces
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/contracts ./packages/contracts
COPY packages/ui ./packages/ui
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY apps/app ./apps/app

# Install dependencies and build SPA
# pnpm (10.x, this lockfile) skips the Linux native packages under vite 8 -
# @esbuild/linux-x64 for esbuild 0.27/0.28 and @rolldown/binding-linux-x64-*
# - so esbuild's postinstall and `vite build` fail. --force installs every
# optional platform package, the native ones for this image included.
RUN pnpm install --frozen-lockfile --force
# VITE_* values are inlined at build time (static nginx image has no runtime
# env), so they must arrive as build args or the bundle falls back to localhost.
ARG VITE_API_URL=http://localhost:8000
ARG VITE_DEV_MODE=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEV_MODE=$VITE_DEV_MODE
RUN pnpm --filter app build

# Stage 2: High-performance Nginx Static Server
FROM nginx:1.27-alpine AS runner

COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
