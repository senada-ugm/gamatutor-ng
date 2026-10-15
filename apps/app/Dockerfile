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
# pnpm leaves out @esbuild/linux-x64 for esbuild 0.27/0.28 on Linux, so
# their postinstall resolves the hoisted 0.25 binary and fails its version
# check. Unhoisted, esbuild's own fallback fetches the matching binary.
RUN pnpm install --frozen-lockfile --config.hoist-pattern='*' --config.hoist-pattern='!@esbuild/*'
RUN pnpm --filter app build

# Stage 2: High-performance Nginx Static Server
FROM nginx:1.27-alpine AS runner

COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
