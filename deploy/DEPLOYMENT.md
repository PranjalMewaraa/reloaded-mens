# Production deployment — Reloaded Menswear

Step-by-step runbook for bringing the monorepo up on the E2E Networks VPS at
`151.185.43.166`, behind Cloudflare, with origin SSL via Caddy.

This document assumes:

- You're deploying for the first time, with all third-party providers in
  mock mode. Real PhonePe / Shiprocket / Resend arrive in later sprints.
- Local dev still works exactly as before (`pnpm dev`, `pnpm docker:up`) —
  none of these production files affect the local workflow.

---

## 0 · Prerequisites

- [ ] VPS provisioned and hardened (SSH-key only, `deploy` sudo user, fail2ban
      or equivalent, automatic security updates).
- [ ] Docker Engine + Compose plugin installed on the VPS
      (`docker --version` shows ≥ 24, `docker compose version` works).
- [ ] You own `reloadedmens.in` and can edit DNS at Cloudflare.
- [ ] A GitHub Personal Access Token with `read:packages` scope (you'll use
      this to pull images from `ghcr.io` on the VPS).
- [ ] First image build has succeeded — the
      [Build & publish images](../.github/workflows/build-images.yml) workflow
      has run at least once on `main` and pushed three images to
      `ghcr.io/<your-user>/menswear-{storefront,admin,api}:latest`.

If image builds haven't happened yet, push to `main` or run the workflow
manually from the Actions tab. Wait for it to finish before continuing.

---

## 1 · DNS at Cloudflare

Add four A records pointing at the VPS. **All four start as DNS-only (gray
cloud) so Caddy can issue Let's Encrypt certs over HTTP-01** — Cloudflare's
proxy would otherwise eat the challenge.

| Type | Name    | Content            | Proxy status |
|------|---------|--------------------|--------------|
| A    | `@`     | `151.185.43.166`   | DNS only     |
| A    | `www`   | `151.185.43.166`   | DNS only     |
| A    | `admin` | `151.185.43.166`   | DNS only     |
| A    | `api`   | `151.185.43.166`   | DNS only     |

Verify propagation:

```bash
dig +short reloadedmens.in
dig +short www.reloadedmens.in
dig +short admin.reloadedmens.in
dig +short api.reloadedmens.in
```

All four should return `151.185.43.166`.

You'll flip these to Proxied (orange cloud) **after** the first deploy
works end-to-end (Step 5).

---

## 2 · VPS first-time setup

SSH in:

```bash
ssh deploy@151.185.43.166
```

Create the deployment directory and backups folder:

```bash
sudo mkdir -p /opt/menswear /opt/menswear/backups
sudo chown -R deploy:deploy /opt/menswear
cd /opt/menswear
```

Authenticate with the GitHub Container Registry. Use the PAT from step 0:

```bash
echo 'YOUR_PAT_VALUE' | docker login ghcr.io -u your-github-username --password-stdin
```

Generate the database password and JWT secrets:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "JWT_STAGE_SECRET=$(openssl rand -base64 32)"
echo "JWT_CUSTOMER_ACCESS_SECRET=$(openssl rand -base64 32)"
echo "JWT_CUSTOMER_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "TRACKING_TOKEN_SECRET=$(openssl rand -base64 32)"
echo "REVIEW_TOKEN_SECRET=$(openssl rand -base64 32)"
echo "MOCK_PAYMENT_WEBHOOK_SECRET=$(openssl rand -base64 32)"
```

Copy these into the `.env` file in Step 3. **Each secret must be a unique
random string** — never reuse a value across two slots.

---

## 3 · Copy configs to the VPS

From your laptop (not the VPS), in the repo root:

```bash
# Caddyfile — the reverse proxy config.
scp deploy/Caddyfile deploy@151.185.43.166:/opt/menswear/Caddyfile

# Compose file — rename to docker-compose.yml on the VPS so `docker compose`
# picks it up automatically.
scp deploy/docker-compose.production.yml deploy@151.185.43.166:/opt/menswear/docker-compose.yml

# Env template — copied as .env then filled in.
scp deploy/.env.production.example deploy@151.185.43.166:/opt/menswear/.env
```

Back on the VPS:

```bash
cd /opt/menswear

# Edit the env file — paste the secrets from Step 2 into the REPLACE_*
# placeholders. Set GITHUB_USER to your lowercase GitHub username.
nano .env

# Lock it down so only deploy can read it.
chmod 600 .env
```

Verify the `.env` looks right:

```bash
grep REPLACE_ .env  # should return nothing
```

If grep prints lines, you missed a placeholder.

---

## 4 · First deploy

Pull the images from ghcr.io. This is the slow part on first run — about
500 MB of image data:

```bash
cd /opt/menswear
docker compose pull
```

Bring up the data layer only — Caddy + apps still down:

```bash
docker compose up -d postgres redis
docker compose ps  # both should report `healthy` within ~10s
```

Run the migrations against the empty database:

```bash
docker compose run --rm api pnpm --filter @repo/db migrate:deploy
```

Seed the initial data (admin user, sample products, business settings):

```bash
docker compose run --rm api pnpm --filter @repo/db seed
```

Start everything else:

```bash
docker compose up -d
```

Watch the Caddy log to confirm SSL certs are issued (~30 s on first run):

```bash
docker compose logs -f caddy
# look for: "certificate obtained successfully"
# Ctrl+C to exit the follow
```

Sanity-check every container is healthy:

```bash
docker compose ps
# all 6 services should show "healthy" or "running"
```

---

## 5 · Verify externally

The site should now answer on the real domain. All three hostnames should
return 200 directly:

```bash
curl -I https://reloadedmens.in
# HTTP/2 200

curl -s https://api.reloadedmens.in/api/v1/health
# {"status":"ok",...}
```

In a browser, visit `https://reloadedmens.in` — the storefront should load
directly. Then visit `https://admin.reloadedmens.in` — the admin app's own
login screen appears (no edge basic-auth gate).

Log into the admin (the seed creates `admin@example.com` with password
`changeme` — change it immediately from the profile page, or via
`docker compose exec postgres psql -U menswear -d menswear`).

---

## 6 · Flip Cloudflare to Proxied

Now that SSL works end-to-end, enable Cloudflare's proxy for the
performance + DDoS benefits. In the Cloudflare DNS dashboard, flip all four
A records from gray cloud to orange cloud.

Under SSL/TLS → Overview, set encryption mode to **Full (strict)**.

Verify again:

```bash
curl -I https://reloadedmens.in
# HTTP/2 200 (now served via Cloudflare's proxy)
```

---

## 7 · Subsequent deploys

After a new image is pushed by the workflow:

```bash
ssh deploy@151.185.43.166
cd /opt/menswear
docker compose pull
docker compose up -d
```

`up -d` only recreates containers whose images changed — Postgres/Redis stay
running, your data is safe.

To pin a specific commit (rollback or hotfix):

```bash
# Edit .env:
nano .env
# Change: IMAGE_TAG=latest
# To:     IMAGE_TAG=sha-abc1234...   (full SHA from the workflow run)
docker compose pull
docker compose up -d
```

---

## 8 · Going live

The Caddyfile in this repo ships in launch posture: storefront is fully
public + indexable, admin + api are gated by their own JWT auth and kept
`noindex` so search engines don't list them. No edge basic_auth anywhere.

If you ever want to lock admin / api behind an IP allowlist instead, add
inside the relevant site block:

```caddyfile
@allowed remote_ip <your-ip>/32
respond @!allowed 403
```

After any Caddyfile change:

```bash
docker compose restart caddy
curl -I https://reloadedmens.in   # HTTP/2 200
```

---

## Common issues

### Caddy can't issue SSL certs

```
acme: error: 400 :: urn:ietf:params:acme:error:connection ...
```

Almost always Cloudflare is proxying the DNS records before Let's Encrypt
challenges complete. Set all four records back to DNS-only (gray cloud),
wait 2 minutes, then `docker compose restart caddy`.

### Container repeatedly restarts

```bash
docker compose logs --tail=100 <service-name>
```

For the API, the usual cause is a missing env var the service requires at
boot. The api throws on missing JWT secrets; check the `.env` has all the
entries listed in `deploy/.env.production.example`.

### Prisma "Query engine library for current platform not found"

The schema's `binaryTargets` must include `linux-musl-openssl-3.0.x`. The
image is built from `packages/db/prisma/schema.prisma`; if you forked the
schema and removed it, regenerate and rebuild.

### CORS errors in the browser

The storefront talks to the API server-to-server in production (via
internal docker DNS), so CORS rarely matters. If a client-side fetch
complains, `CORS_ORIGINS` in `.env` must list every hostname the browser
sends requests from — including the `www.` variant.

### 502 Bad Gateway from Caddy

A backend container exited and Caddy can't reach it. `docker compose ps`
shows which. `docker compose logs <name>` to see why.

---

## Maintenance

### Logs

```bash
# Tail everything
docker compose logs -f

# One service, last 200 lines
docker compose logs --tail=200 api
```

### Database backups

```bash
# Manual dump — runs daily via cron in a later sprint.
docker compose exec postgres pg_dump -U menswear -d menswear \
  > /opt/menswear/backups/menswear-$(date +%F-%H%M).sql

# Restore (be sure!)
cat backup.sql | docker compose exec -T postgres psql -U menswear -d menswear
```

### Restart a single service

```bash
docker compose restart api
```

### Open a psql shell

```bash
docker compose exec postgres psql -U menswear -d menswear
```

### Reload Caddy after editing the Caddyfile

```bash
docker compose restart caddy
```

### Disk usage

```bash
docker system df
# Periodically:
docker system prune -af --volumes  # WARNING: nukes unused volumes too
```
