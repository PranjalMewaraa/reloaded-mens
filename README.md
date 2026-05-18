# Reloaded Menswear — monorepo

Custom Next.js + NestJS ecommerce platform for the Reloaded Menswear brand.
Turborepo + pnpm workspaces, Node 22 LTS.

## Apps

| Package            | Path                 | Port (dev) | Notes                                  |
|--------------------|----------------------|-----------:|----------------------------------------|
| `@repo/storefront` | `apps/storefront/`   |       3000 | Public storefront (Next.js)            |
| `@repo/admin`      | `apps/admin/`        |       3001 | Admin panel (Next.js)                  |
| `@repo/api`        | `apps/api/`          |       4000 | API + admin/customer auth (NestJS)     |

## Packages

- `@repo/config` — shared eslint + tsconfig presets
- `@repo/db` — Prisma schema + generated client
- `@repo/types` — shared Zod schemas + TS types
- `@repo/ui` — shared React components

## Local development

```bash
# Install deps and copy env
pnpm install
cp .env.example .env

# Bring up Postgres + Redis in Docker
pnpm docker:up

# Generate the Prisma client + apply migrations + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Run all three apps in parallel
pnpm dev
```

Visit:
- Storefront → http://localhost:3000
- Admin → http://localhost:3001
- API → http://localhost:4000/api/v1/health

### Common commands

```bash
pnpm lint
pnpm typecheck
pnpm build

pnpm db:studio          # Prisma Studio
pnpm docker:logs        # tail postgres + redis logs
pnpm docker:down        # stop the dev containers
```

## Deployment

Full runbook lives at [`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md).
Production stack: Caddy → 3 Next/NestJS containers → Postgres + Redis,
all behind Cloudflare with origin SSL.

| Surface      | URL                            |
|--------------|--------------------------------|
| Storefront   | https://reloadedmens.in        |
| Admin        | https://admin.reloadedmens.in  |
| API          | https://api.reloadedmens.in    |

```bash
# SSH to the VPS
ssh deploy@151.185.43.166

# Pull latest images + roll containers
cd /opt/menswear
docker compose pull && docker compose up -d
```

Images are built by GitHub Actions
([`.github/workflows/build-images.yml`](.github/workflows/build-images.yml))
on every push to `main` and pushed to `ghcr.io/<owner>/menswear-*`.

The platform is in pre-launch mode — basic-auth gates all three sites and
search engines are explicitly blocked via `X-Robots-Tag: noindex`. See
DEPLOYMENT.md §8 for the launch-day flip.
