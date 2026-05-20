# Reloaded Menswear — roadmap snapshot

Snapshot taken on **2026-05-20**, branched from `design-fix-2` into `post-mvp-stage`.

The full plan lives in [`docs/implementation_plan.md`](./docs/implementation_plan.md).
This file is the high-level "what's done vs what's left" view — re-generate it
when the answer changes.

---

## Phase 1 — MVP

Demonstrable end-to-end ecommerce with everything real except external
integrations (payments, shipping, SMS, email send, lead ads, analytics).

| Sprint | Theme | Status |
|---|---|---|
| 0 | Foundation — monorepo, tooling, base Docker | ✅ done |
| 1 | Data + admin auth (AdminUser, JWT, TOTP, audit log) | ✅ done |
| 2 | Catalog management (Category, Product, Variant CRUD) | ✅ done |
| 3 | Storefront catalog (PDP, /shop, /c/[slug], serviceability widget) | ✅ done |
| 4 | Cart + checkout w/ mock payment | ✅ done |
| 5 | Order lifecycle + admin ops (state machine, mock shipping, labels) | ✅ done |
| 6 | Returns + exchanges + refunds | ✅ done |
| 7 | Coupons + basic promotions engine | ✅ done |
| 8 | Customer auth (email OTP), leads, text reviews | ✅ done |
| 9 | Reports + polish + hardening | 🟡 **partial** |

### What Sprint 9 still owes us

The polish + hardening pass that gates "MVP complete." Most of the polish
landed organically through deploy iteration, but the explicit deliverables:

- ❌ **Reports module** — sales (daily/weekly/monthly revenue, order count,
  AOV), top products by units + revenue, top customers, returns rate. Each
  with a CSV export. No dedicated endpoints exist yet — the admin dashboard
  shows a few counts but isn't the full report surface.
- ❌ **Rate limiting** — no `ThrottlerModule` wired. Auth endpoints, OTP
  request, coupon validation, public-catalog reads should all be throttled.
- 🟡 **Empty states / loading skeletons / error states** — partial coverage,
  good on the main flows but not audited end-to-end.
- ❌ **Accessibility audit pass** — keyboard nav, focus states, ARIA labels,
  colour contrast. No formal sweep done.
- ❌ **Lighthouse / Core Web Vitals audit** — no measurement on file.
- ❌ **Cross-browser smoke test** — Chrome/Firefox/Safari on desktop + real
  Android + iPhone Safari. Smoke-tested by the team in dev only.
- ❌ **API docs via Swagger** — NestJS Swagger module not wired.
- ❌ **Runbook docs** — "how to add a product", "how to process a return",
  etc. The deploy runbook exists (`deploy/DEPLOYMENT.md`) but operational
  runbooks don't.

---

## Bonus work shipped beyond the plan

Things landed in this stretch that weren't on the original roadmap but
were needed:

- ✅ Production VPS deploy (E2E Networks, Docker Compose, Caddy reverse
  proxy with Let's Encrypt, Cloudflare in front, GHA → GHCR pipeline).
- ✅ Cross-subdomain cookie auth (`COOKIE_DOMAIN=.reloadedmens.in`).
- ✅ Storage persistence fix (`STORAGE_LOCAL_PATH`, volume permissions).
- ✅ Hero / homepage / footer / PDP design polish (animated marquees,
  testimonials section, magazine-style PDP gallery, WhatsApp FAB, Instagram
  + phone contacts in footer).
- ✅ **Staff management with per-module permissions** — the management UI
  ships in the previous commit. Per-module enforcement guard (the
  `@RequireModule()` decorator across admin controllers) is a known
  follow-up.

---

## Phase 2 — Full Product

Real third-party integrations + remaining feature breadth. Each sprint
assumes the corresponding external account is already onboarded (see the
pre-Phase-2 setup checklist in `implementation_plan.md` §3.2).

| Sprint | Theme | Status | Notes |
|---|---|---|---|
| 10 | Real payments — PhonePe PG + GST invoice generation | ❌ not started | PhonePe KYC needs to start 3–7 working days ahead |
| 11 | Real shipping — Shiprocket integration, real rates, real tracking | ❌ not started | Shiprocket KYC + pickup-address config |
| 12 | SMS (MSG91 + DLT) + WhatsApp Business API + real email templates | ❌ not started | DLT registration alone takes 1–2 weeks; WhatsApp templates 24–48h each for ~10 templates |
| 13 | Meta Lead Ads integration + abandoned-cart recovery flow | ❌ not started | Meta App Review can take 1–3 weeks |
| 14 | Meta Pixel + Conversions API + attribution dashboard | ❌ not started | |
| 15 | Photo reviews + remaining promo mechanics + R2/S3 migration | ❌ not started | Migrate uploads from VPS volume to Cloudflare R2 |
| 16 | Performance + accessibility + SEO hardening pass | ❌ not started | |
| 17 | Observability (Sentry, structured logs) + launch prep | ❌ not started | |

---

## Other known follow-ups (smaller than a sprint)

Carried in commit messages or comments rather than the plan doc. Mostly
hardening / safety:

- **Module-permission enforcement.** Staff permissions are stored + UI-
  managed but not yet checked at the controller level. Need a
  `@RequireModule('orders')` decorator + `ModuleGuard` applied across
  admin-scoped controllers (~10 files).
- **Storage URL canonicalisation.** Both upload URL host *and* upload path
  are persisted, so moving storage drivers (local → R2) requires a DB
  rewrite. Better: store keys only, build URLs at serialise time from
  current `PUBLIC_API_URL` / R2 base.
- **OTP rate-limit in Redis.** Currently a process-local Map keyed by phone
  — fine for one api container, breaks if we ever scale to N. Slotted with
  Sprint 17 (observability) but could move earlier.
- **Refresh-token path mismatch on storefront cookies.** Refresh cookies
  have `path=/api/v1/auth/refresh` so the browser only sends them on that
  exact URL. Admin SSR forwards via `cookies()` correctly; storefront's
  customer-server helper does too. But if either ever ends up using
  client-side fetch for refresh, the path scoping needs revisiting.
- **`+N more` lightbox on the magazine PDP gallery** when a product ships
  more than 4 photos. Cycling through reveals them today, but a "view all"
  affordance would be nicer.
- **Hours on `/visit` page** — currently hardcoded "Tuesday–Sunday, 11am–
  9pm". Verify these match the actual store.
- **API Swagger docs** — overlaps with Sprint 9 but worth pulling forward
  if anyone outside the team needs to integrate.

---

## What lands next, in priority order

If you want a default sequence, I'd run them in this order — risk-weighted,
not feature-weighted:

1. **Pre-Phase-2 onboarding** (PhonePe, Shiprocket, MSG91 DLT, Meta App
   Review) — start NOW because of external lead times.
2. **Module-permission enforcement** — feature already shipped but not
   actually secured. Small change, big risk reduction.
3. **Sprint 9 hardening** — rate limiting + audit log coverage + soft-
   delete enforcement. The "you forgot a load-bearing thing" risk.
4. **Sprint 10 — PhonePe + GST invoices** — soonest revenue-blocker once
   PG onboarding finishes.
5. **Sprint 11 — Shiprocket** — fulfilment without manual hand-printing
   labels.
6. **Sprint 12 — SMS + WhatsApp + Resend templates** — drops the manual
   "I'll WhatsApp you about your order" support load.
7. **Reports module** (Sprint 9 leftover) — once real orders start flowing.
8. The rest of Phase 2 (Sprints 13–17) once 10–12 are stable.

---

*This file is meant to be churned. Re-generate when the answer shifts.*
