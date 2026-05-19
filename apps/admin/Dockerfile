# syntax=docker/dockerfile:1.7
#
# Production image for @repo/admin. See apps/storefront/Dockerfile for the
# annotated multi-stage pattern; admin mirrors it but on port 3001 and
# crucially also generates the Prisma client because Server Components in
# /dashboard and /customers read prisma directly.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
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
ENV NEXT_TELEMETRY_DISABLED=1
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
# Admin reads @repo/db directly in Server Components — the Prisma client must
# exist before `next build` traces its types.
RUN pnpm --filter @repo/db exec prisma generate

# NEXT_PUBLIC_* env vars are inlined into the admin bundle at build time
# (not read at runtime). Receive them as build args from docker-build-push and
# promote each to ENV so Next picks them up. Mismatched URLs here = the admin
# UI calls localhost:4000 in production. NEXT_PUBLIC_STOREFRONT_URL is used by
# admin to build "Open customer tracking link" buttons on the order detail
# page — without it those links 404. See the GHA workflow for the values it
# passes.
ARG NEXT_PUBLIC_ADMIN_API_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_STOREFRONT_URL
ENV NEXT_PUBLIC_ADMIN_API_URL=${NEXT_PUBLIC_ADMIN_API_URL}
ENV NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL}
ENV NEXT_PUBLIC_STOREFRONT_URL=${NEXT_PUBLIC_STOREFRONT_URL}

# Bump V8 heap so Next's webpack + file-tracing doesn't OOM on the default
# ~1.5 GB heap inside the Docker build sandbox.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm turbo run build --filter=@repo/admin

# Belt-and-suspenders for the Prisma engine binary. Even with the
# `outputFileTracingIncludes` config in next.config.ts, Next's standalone
# tracer has historically been flaky about `.so.node` files. After the build
# we explicitly mirror the engine binary + generated client from the
# builder's pnpm store into the matching path inside the standalone tree.
# The glob walks whatever `@prisma+client@<version>_prisma@<version>` dir
# pnpm produced, so this stays valid across Prisma upgrades.
RUN set -eux; \
    for src_dir in /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma; do \
        rel="${src_dir#/app/}"; \
        dest="/app/apps/admin/.next/standalone/${rel}"; \
        mkdir -p "$(dirname "$dest")"; \
        # rm first so `cp -a src dest` replaces (instead of nesting into
        # an existing dir that the tracer may have stubbed out).
        rm -rf "$dest"; \
        cp -a "$src_dir" "$dest"; \
    done

# ------------------- runner -------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# openssl for Prisma's query-engine on Alpine (linux-musl-openssl-3.0.x).
# Without this the engine .so.node loads but errors at first query with
# `Error loading shared library libssl.so.3`.
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/admin/server.js"]
