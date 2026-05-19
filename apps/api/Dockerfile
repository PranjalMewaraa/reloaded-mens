# syntax=docker/dockerfile:1.7
#
# Production image for @repo/api (NestJS).
#
# The API is webpack-bundled — workspace TS (@repo/db, @repo/types) is inlined
# into dist/main.js by webpack with nodeExternals(allowlist:[/^@repo\//]).
# That means the runner only needs:
#   - dist/main.js
#   - apps/api/node_modules (npm deps externalised by webpack)
#   - the Prisma client + engine binaries that live under node_modules/.prisma
#
# We do NOT ship packages/* at runtime — webpack already absorbed the source.
# That keeps the runner image around ~250 MB instead of ~400 MB.
#
# No native build chain (python/make/g++) needed: bcryptjs is pure JS,
# everything else (passport-jwt, otplib, qrcode, etc.) ships prebuilt.
# Only openssl is installed in the runner so Prisma's query engine can load.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# openssl for Prisma's query engine library (linux-musl-openssl-3.0.x).
RUN apk add --no-cache openssl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# ------------------- deps -------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/storefront/package.json ./apps/storefront/
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# ------------------- builder -------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/storefront/node_modules ./apps/storefront/node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY . .
RUN pnpm install --frozen-lockfile --prefer-offline
# Generate the Prisma client BEFORE building the API. NestJS / webpack would
# fail to resolve `@prisma/client` types otherwise.
RUN pnpm --filter @repo/db exec prisma generate
# Bump V8 heap to 4 GB — the api webpack bundle inlines all @repo/* TS
# (workspace packages allowlisted in webpack-node-externals). On the default
# 1.5 GB heap this OOMs partway through ts-loader's parse phase.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm turbo run build --filter=@repo/api

# ------------------- runner -------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=4000
ENV API_HOST=0.0.0.0

# Prisma's query-engine binary needs openssl on Alpine. wget is for the
# healthcheck (alpine's busybox wget supports the bare flags Docker expects).
RUN apk add --no-cache openssl wget
# pnpm — needed by the runbook commands `pnpm --filter @repo/db migrate:deploy`
# and `pnpm --filter @repo/db seed`, which we exec into a running api
# container on first deploy.
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Non-root runtime user.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs

# Pre-create the upload directory and chown to the runtime user BEFORE the
# named volume mounts on top of it. Docker copies the image's directory
# permissions to a FRESH volume on first mount — so this gives the volume
# nestjs ownership from the start. If you ever change STORAGE_LOCAL_PATH in
# .env, update the path here to match (or grant the existing volume the
# right perms manually). Without this, mkdir at the api runtime layer would
# EACCES because /data is root-owned in the base image.
#
# NOTE: an EXISTING volume keeps its original ownership when this image is
# pulled — Docker only seeds permissions on the first mount of a fresh
# volume. To apply this fix to an already-created volume, the volume has
# to be removed (`docker volume rm menswear_api_storage`) once.
RUN mkdir -p /data/storage \
    && chown -R nestjs:nodejs /data /data/storage

# Runtime payload:
#  - apps/api/dist            — webpack-bundled main.js
#  - apps/api/package.json    — main + "type":"module" resolution
#  - apps/api/node_modules    — npm deps webpack externalised
#  - node_modules             — root deps incl. @prisma/client + engine binaries
#  - packages/db              — schema, migrations, seed.ts (for migrate:deploy
#                                and seed via `pnpm --filter @repo/db ...`)
#  - pnpm workspace files     — so the `--filter` selector resolves
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Working directory matches where nest's webpack output expects to live.
WORKDIR /app/apps/api

USER nestjs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --spider --quiet http://127.0.0.1:4000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
