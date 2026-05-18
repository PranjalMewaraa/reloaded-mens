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
RUN pnpm turbo run build --filter=@repo/admin

# ------------------- runner -------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

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
