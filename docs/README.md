# Menswear Ecommerce Monorepo

Custom-built ecommerce platform for a mid-market men's clothing brand in India. Custom storefront, custom admin panel, custom backend. India-first, mobile-first.

See `docs/architecture_plan.md` for the full spec and `docs/implementation_plan.md` for the phased build.

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Storefront:** Next.js 15 (App Router) + Tailwind CSS + TypeScript
- **Admin panel:** Next.js 15 + Tailwind CSS + TypeScript
- **Backend API:** NestJS + TypeScript + Prisma
- **Database:** PostgreSQL 16
- **Cache / queue:** Redis 7
- **Node:** 22 LTS

## Project layout

```
.
├── apps/
│   ├── api/          NestJS backend API
│   ├── admin/        Admin panel (Next.js, port 3001)
│   └── storefront/   Customer storefront (Next.js, port 3000)
├── packages/
│   ├── config/       Shared eslint + tsconfig presets
│   ├── db/           Prisma schema, client, migrations, seed
│   ├── types/        Shared TypeScript types and Zod schemas
│   └── ui/           Shared React components
├── docker-compose.yml   Local Postgres + Redis
├── turbo.json           Turborepo pipeline config
└── pnpm-workspace.yaml  Workspace globbing
```

## Prerequisites

- **Node 22** (`nvm use` reads `.nvmrc`)
- **pnpm 9+** (`npm install -g pnpm`)
- **Docker** (for local Postgres + Redis)

## First-time setup

```bash
# Clone and install
git clone <repo-url>
cd menswear-monorepo
pnpm install

# Copy env file and adjust if needed
cp .env.example .env

# Start Postgres + Redis
pnpm docker:up

# Generate Prisma client and run initial migration
pnpm db:generate
pnpm db:migrate

# Seed baseline data (admin user, settings)
pnpm db:seed

# Start all apps in dev mode (parallel)
pnpm dev
```

After `pnpm dev`:

- Storefront: <http://localhost:3000>
- Admin: <http://localhost:3001>
- API: <http://localhost:4000/api/v1>
- API health: <http://localhost:4000/api/v1/health>

Default admin (seeded): `admin@example.com` / `changeme` — reset on first real login flow.

## Common commands

```bash
# Run a specific app only
pnpm --filter @repo/api dev
pnpm --filter @repo/storefront dev
pnpm --filter @repo/admin dev

# Database
pnpm db:generate           Regenerate Prisma client after schema change
pnpm db:migrate            Create + apply a new migration
pnpm db:studio             Open Prisma Studio (browser DB explorer)
pnpm db:seed               Re-seed the DB

# Docker
pnpm docker:up             Start Postgres + Redis
pnpm docker:down           Stop them
pnpm docker:logs           Tail container logs

# Quality
pnpm lint                  Lint everything
pnpm typecheck             Typecheck everything
pnpm test                  Run tests
pnpm format                Format with Prettier
pnpm format:check          Check formatting (used by CI)

# Build
pnpm build                 Build all apps
```

## Environment variables

All env vars live in a single `.env` at the repo root. Apps load from there. See `.env.example` for the full list.

Notable groups:

- **Database & Redis** — connection strings for local Docker services
- **API** — JWT secrets, CORS origins, port
- **Storage** — `STORAGE_DRIVER=local` for MVP (writes to `./storage`); `r2` once integrated
- **Payments** — `PAYMENT_PROVIDER=mock` for MVP; `phonepe` once integrated
- **Shipping** — `SHIPPING_PROVIDER=mock` for MVP; `shiprocket` once integrated
- **Storefront / Admin (NEXT_PUBLIC_*)** — exposed to the browser

## Workspace packages

Packages are referenced via `workspace:*` in `package.json`. Apps import them as `@repo/<name>`:

```ts
import { prisma } from '@repo/db';
import { phoneSchema, ORDER_STATE } from '@repo/types';
import { Button, cn } from '@repo/ui';
```

Workspace TypeScript packages export their `src/index.ts` directly. Next.js transpiles them via `transpilePackages` in `next.config.ts` — no build step required during development.

## Adding a new model

1. Edit `packages/db/prisma/schema.prisma`
2. Run `pnpm db:migrate` and name the migration
3. Run `pnpm db:generate` (usually automatic, but safe to re-run)
4. Use the model anywhere via `import { prisma } from '@repo/db'`

## Adding a new package

1. Create `packages/<name>/` with a `package.json` named `@repo/<name>`
2. Add a `tsconfig.json` that extends `@repo/config/tsconfig.base.json`
3. Run `pnpm install` at the root
4. Reference it from other packages with `"@repo/<name>": "workspace:*"`

## CI

GitHub Actions runs on every push and PR (`.github/workflows/ci.yml`):

- Install with frozen lockfile
- Generate Prisma client
- Format check
- Lint
- Typecheck
- Build

A Postgres service container is provisioned so Prisma can run during CI.

## Sprint status

Currently at **Sprint 0 — Foundation** complete. Monorepo scaffolding is live; CI is green; `pnpm dev` boots all three apps; baseline data model and Prisma migrations work; health endpoint responds.

Next up: **Sprint 1 — Data foundations & admin auth** (see `docs/implementation_plan.md`).

## License

Proprietary — not for redistribution.
