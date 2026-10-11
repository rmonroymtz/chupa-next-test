# syntax=docker/dockerfile:1.7
#
# Chupaprecios storefront: Next.js `output: 'standalone'` image.
#
# Base: Debian bookworm slim (glibc) rather than Alpine (musl). `sharp`, used
# by the `next/image` optimizer, ships prebuilt glibc binaries that are the
# best-tested path; on musl it needs the separate linuxmusl packages and has
# had allocator/performance issues. The size difference is small next to the
# app itself.
#
# Build-time configuration (fixed in the image, pass with --build-arg):
#   IMAGE_REMOTE_HOSTS              next/image remote hosts
#   SERVER_ACTIONS_ALLOWED_ORIGINS  extra origins for the Server Action CSRF check
# Every other variable is runtime configuration (task definition), see
# docs/deploy/ecs-fargate.md. The build stage needs network access:
# next/font downloads the Google fonts during `pnpm build`.

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
# Corepack activates the exact pnpm version pinned in `packageManager`.
COPY package.json ./
RUN corepack enable && corepack install

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM base AS build
ARG IMAGE_REMOTE_HOSTS=""
ARG SERVER_ACTIONS_ALLOWED_ORIGINS=""
ENV IMAGE_REMOTE_HOSTS=${IMAGE_REMOTE_HOSTS} \
    SERVER_ACTIONS_ALLOWED_ORIGINS=${SERVER_ACTIONS_ALLOWED_ORIGINS} \
    NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# `output: 'standalone'` leaves out static assets: copy them next to server.js.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Unprivileged user shipped with the official Node image (uid 1000).
USER node
EXPOSE 3000

# Local/compose convenience; ECS uses the task definition health check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "server.js"]
