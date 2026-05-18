# syntax=docker/dockerfile:1.7
#
# Production image for @repo/storefront.
#
# Four-stage build:
#   1. base    — node:22-alpine + corepack pnpm@9.12.0 (matches root packageManager).
#   2. deps    — installs the full monorepo deps from the workspace lockfile.
#                Only package.json + lockfile + workspace manifests copied, so
#                this layer caches across source changes.
#   3. builder — copies the rest of the repo, re-runs pnpm install to relink
#                workspace symlinks, generates the Prisma client (Next traces
#                files used by @repo/db transitively in some configs), then
#                runs `turbo run build --filter=@repo/storefront`.
#   4. runner  — fresh alpine, non-root, copies only the Next standalone
#                output + static + public. Healthcheck against /api/health.

# ------------------- base -------------------
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# ------------------- deps -------------------
FROM base AS deps
# Copy the dependency manifests only. This layer rebuilds only when any
# package.json or the lockfile changes.
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
# Relink workspace symlinks (fast — node_modules is already populated).
RUN pnpm install --frozen-lockfile --prefer-offline
# Storefront doesn't import @repo/db, but generate the Prisma client anyway —
# turbo's `^build` graph may pull packages/db, and a missing client breaks
# parallel typechecks on a cold build. Generate is cheap (<5 s).
RUN pnpm --filter @repo/db exec prisma generate
RUN pnpm turbo run build --filter=@repo/storefront

# ------------------- runner -------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user. uid 1001 matches the GitHub Actions docker runner conventions
# and keeps file ownership tidy when volume-mounting backups.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Next standalone output is repo-rooted (because of outputFileTracingRoot).
# That means server.js sits at <standalone>/apps/storefront/server.js and the
# pruned node_modules tree sits at <standalone>/node_modules with workspace
# symlinks already resolved.
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/public ./apps/storefront/public

USER nextjs
EXPOSE 3000

# Local healthcheck — curl isn't in alpine by default; use node's HTTP client.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/storefront/server.js"]
