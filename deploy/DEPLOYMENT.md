# Production deployment — Reloaded Menswear

Step-by-step runbook for bringing the monorepo up on an **Oracle Cloud
Always-Free ARM A1** instance (4 vCPUs, 24 GB RAM — ₹0/month), behind
Cloudflare, with origin SSL via Caddy.

> **E2E Networks users:** the only differences from your old setup are
> the two-firewall gotcha (§2), the `ubuntu` username (not `root`), and
> the ARM image platform (handled automatically by the GHA workflow).

---

## 0 · Prerequisites

- [ ] Oracle Cloud account created and verified with a credit/debit card
      (the card is not charged for Always-Free resources).
- [ ] ARM A1 instance provisioned (see §1 below).
- [ ] Docker Engine + Compose plugin installed on the instance.
- [ ] You own `reloadedmens.in` and can edit DNS at Cloudflare.
- [ ] A GitHub PAT with `read:packages` scope to pull GHCR images.
- [ ] Images built — the GHA workflow must have run at least once on
      `main` and pushed `ghcr.io/<user>/menswear-{storefront,admin,billing,api}:latest`.

---

## 1 · Provision the Oracle ARM instance

1. Sign in → **Compute → Instances → Create Instance**.
2. **Name:** `menswear-prod`
3. **Image:** Ubuntu 22.04 (Minimal) — click *Change image*.
4. **Shape:** Click *Change shape* → **Ampere** → `VM.Standard.A1.Flex`
   → set **4 OCPUs / 24 GB RAM** (stays within Always-Free quota).
5. **Networking:** Keep the default VCN/subnet, ensure *Assign a public
   IPv4 address* is **ON**.
6. **SSH keys:** Upload your public key (or paste it). Oracle does **not**
   let you set a password — key-only.
7. Click **Create**. Wait ~2 minutes for the instance to reach *Running*.
8. Note the **Public IP** from the instance detail page — you'll use it
   everywhere `<ORACLE_IP>` appears below.

---

## 2 · Open ports — TWO firewalls (critical Oracle gotcha)

Oracle has **two independent firewalls** and you must open ports in both
or traffic is blocked silently.

### 2a — Oracle Security List (VCN level)

Networking → Virtual Cloud Networks → your VCN → Security Lists →
Default Security List → **Add Ingress Rules**:

| Source CIDR   | Protocol | Destination Port |
|---------------|----------|-----------------|
| `0.0.0.0/0`   | TCP      | 80               |
| `0.0.0.0/0`   | TCP      | 443              |

Leave SSH (port 22) — it's already there.

### 2b — Ubuntu iptables (OS level)

SSH in first (`ssh ubuntu@<ORACLE_IP>`), then:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

If `netfilter-persistent` is not installed:

```bash
sudo apt-get install -y iptables-persistent
# answer Yes to both prompts to save current rules
```

---

## 3 · First-time instance setup

SSH in as `ubuntu` (Oracle's default user — **not** `root`):

```bash
ssh ubuntu@<ORACLE_IP>
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker
docker --version          # should show 25+
docker compose version    # should show v2+
```

Create the deployment directory:

```bash
sudo mkdir -p /opt/menswear /opt/menswear/backups
sudo chown -R ubuntu:ubuntu /opt/menswear
cd /opt/menswear
```

Log in to GHCR with your PAT:

```bash
echo 'YOUR_PAT' | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Generate secrets (run each line, copy the output):

```bash
openssl rand -base64 24   # POSTGRES_PASSWORD
openssl rand -base64 32   # JWT_ACCESS_SECRET
openssl rand -base64 32   # JWT_REFRESH_SECRET
openssl rand -base64 32   # JWT_STAGE_SECRET
openssl rand -base64 32   # JWT_CUSTOMER_ACCESS_SECRET
openssl rand -base64 32   # JWT_CUSTOMER_REFRESH_SECRET
openssl rand -base64 32   # TRACKING_TOKEN_SECRET
openssl rand -base64 32   # REVIEW_TOKEN_SECRET
openssl rand -base64 32   # MOCK_PAYMENT_WEBHOOK_SECRET
openssl rand -base64 32   # BILLING_SESSION_SECRET
openssl rand -base64 32   # BILLING_API_TOKEN
```

---

## 4 · DNS at Cloudflare

Add five A records pointing at `<ORACLE_IP>`. **Start as DNS-only (gray
cloud)** so Caddy can get Let's Encrypt certs via HTTP-01 — Cloudflare's
proxy would block the challenge.

| Type | Name      | Content        | Proxy status |
|------|-----------|----------------|--------------|
| A    | `@`       | `<ORACLE_IP>`  | DNS only     |
| A    | `www`     | `<ORACLE_IP>`  | DNS only     |
| A    | `admin`   | `<ORACLE_IP>`  | DNS only     |
| A    | `api`     | `<ORACLE_IP>`  | DNS only     |
| A    | `billing` | `<ORACLE_IP>`  | DNS only     |

Verify propagation (run from your laptop, not the server):

```bash
dig +short reloadedmens.in
dig +short admin.reloadedmens.in
```

Both should return `<ORACLE_IP>`.

---

## 5 · Copy configs to the server

From your **laptop** in the repo root:

```bash
# Replace <ORACLE_IP> with the real IP
scp deploy/Caddyfile ubuntu@<ORACLE_IP>:/opt/menswear/Caddyfile
scp deploy/docker-compose.production.yml ubuntu@<ORACLE_IP>:/opt/menswear/docker-compose.yml
scp deploy/.env.production.example ubuntu@<ORACLE_IP>:/opt/menswear/.env
```

Back **on the server**, edit `.env`:

```bash
cd /opt/menswear
nano .env
```

Fill in every `REPLACE_*` placeholder with the secrets from §3. Key
values to set:

```
GITHUB_USER=your-github-username-lowercase
POSTGRES_PASSWORD=<from openssl>
DATABASE_URL=postgresql://menswear:<POSTGRES_PASSWORD>@postgres:5432/menswear?schema=public

JWT_ACCESS_SECRET=<from openssl>
JWT_REFRESH_SECRET=<from openssl>
JWT_STAGE_SECRET=<from openssl>
JWT_CUSTOMER_ACCESS_SECRET=<from openssl>
JWT_CUSTOMER_REFRESH_SECRET=<from openssl>
TRACKING_TOKEN_SECRET=<from openssl>
REVIEW_TOKEN_SECRET=<from openssl>
MOCK_PAYMENT_WEBHOOK_SECRET=<from openssl>

BILLING_EMAIL=biller@reloadedmens.com
BILLING_PASSWORD=<strong password>
BILLING_SESSION_SECRET=<from openssl>
BILLING_API_TOKEN=<from openssl>
```

Lock it down:

```bash
chmod 600 .env
grep REPLACE_ .env   # must return nothing
```

---

## 6 · First deploy

Pull images (slow first time — ~500 MB):

```bash
cd /opt/menswear
docker compose pull
```

Start the data layer only and wait for healthy:

```bash
docker compose up -d postgres redis
docker compose ps   # both should show "healthy" within ~15s
```

Run the database migration:

```bash
docker compose run --rm api pnpm --filter @repo/db migrate:deploy
```

Seed initial data (admin user, sample products, POS settings):

```bash
docker compose run --rm api pnpm --filter @repo/db seed
```

Start everything:

```bash
docker compose up -d
docker compose ps   # all services should be running/healthy
```

Watch Caddy issue SSL certs (~30s on first run):

```bash
docker compose logs -f caddy
# look for: certificate obtained successfully
# Ctrl+C when done
```

---

## 7 · Verify and flip Cloudflare to Proxied

```bash
curl -s https://api.reloadedmens.in/api/v1/health
# {"status":"ok",...}

curl -I https://reloadedmens.in
# HTTP/2 200
```

Once SSL works end-to-end, flip all five DNS records to **Proxied (orange
cloud)** in Cloudflare. Then set **SSL/TLS → Full (strict)**.

---

## 8 · Post-deploy checklist

- [ ] Log into `https://admin.reloadedmens.in` — seed creates
      `admin@example.com` / `changeme`, change it immediately.
- [ ] In admin → Settings, add key `pos.upi_id` = your UPI ID
      (e.g. `reloadedmens@okaxis`).
- [ ] Test `https://billing.reloadedmens.in` — login with the
      `BILLING_EMAIL` / `BILLING_PASSWORD` from `.env`.
- [ ] Test storefront checkout end-to-end (mock payment).

---

## 9 · Subsequent deploys

After a new image is pushed by the GHA workflow:

```bash
ssh ubuntu@<ORACLE_IP>
cd /opt/menswear
docker compose pull
docker compose up -d
```

If a migration was added in the release:

```bash
docker compose run --rm api pnpm --filter @repo/db migrate:deploy
docker compose up -d
```

To pin to a specific commit SHA (rollback):

```bash
# In .env: IMAGE_TAG=sha-abc1234...
docker compose pull && docker compose up -d
```

---

## Common issues

### Caddy can't issue SSL certs

Almost always Cloudflare is proxying before the ACME challenge completes.
Set all five records back to DNS-only (gray cloud), wait 2 minutes, then:

```bash
docker compose restart caddy
```

### Port 80/443 not reachable from outside

Oracle has two firewalls. Confirm both are open (§2). Run on the server:

```bash
sudo iptables -L INPUT -n --line-numbers | grep -E '80|443'
```

If no lines appear, re-run the `iptables` commands in §2b.

### Container repeatedly restarts

```bash
docker compose logs --tail=100 <service-name>
```

For the API, the usual cause is a missing env var. Check `.env` has all
entries from `deploy/.env.production.example`.

### 502 Bad Gateway

A backend container exited. `docker compose ps` shows which.
`docker compose logs <name>` to see why.

---

## Maintenance

```bash
# Tail all logs
docker compose logs -f

# Manual DB backup
docker compose exec postgres pg_dump -U menswear -d menswear \
  > /opt/menswear/backups/menswear-$(date +%F-%H%M).sql

# Open psql
docker compose exec postgres psql -U menswear -d menswear

# Reload Caddy after editing Caddyfile
docker compose restart caddy

# Disk usage
docker system df
```
