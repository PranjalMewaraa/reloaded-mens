# Implementation Plan — Menswear Ecommerce Platform

**Status:** v1 — pre-build implementation plan
**Audience:** Owner, development team, project managers
**Last updated:** May 17, 2026
**Companion docs:** `architecture_plan.md`

---

## 0. Document purpose

This document is the execution plan for building the custom ecommerce platform described in `architecture_plan.md`. It defines:

- The two-phase build approach (MVP first, then Full Product)
- Sprint-by-sprint breakdown with goals, scope, and acceptance criteria
- Pre-launch setup tasks with lead times
- Cross-cutting development practices
- Timeline summary

Use it as the project's source of truth for sequencing, sprint planning, and progress tracking. Architecture decisions live in `architecture_plan.md`; this document is purely about **execution order**.

---

## 1. Philosophy

Two-phase build:

**Phase 1 — MVP** establishes the entire customer journey end-to-end with placeholders for paid integrations. Owner can place a test order, see it in admin, transition it through states, process a return — without spending a rupee on integrations or running into App Review delays.

**Phase 2 — Full Product** replaces MVP placeholders with real production integrations and adds remaining feature breadth. By the end, the product is launch-ready.

**Critical principle:** every external service is behind an interface from day one. When MVP uses a stub payment provider, the contract is the same one the real PhonePe implementation will satisfy later. No throwaway code.

**Payment gateway:** PhonePe Payment Gateway selected for primary integration (high UPI success rates, current zero-fee promotional pricing). PhonePe-specific risks and buffers are noted in Sprint 10.

---

## 2. Phase 1 — MVP

**Target:** ~10 weeks with 2–3 developers full-time.

### 2.1 What's IN the MVP

- Full storefront browse and purchase flow
- Full admin panel (both Admin and Staff roles)
- Order lifecycle end-to-end with state transitions
- Returns / exchanges / replacements flows
- Coupon engine basics (codes + simple conditions)
- Pincode serviceability (owner-managed allowlist, no Shiprocket call)
- Mock payment provider (auto-succeeds in dev; toggle to fail for testing)
- Mock shipping provider (no real AWB, simulated states)
- Email transactional via Resend free tier
- In-app notifications for admin
- Manual stock decrement workflow
- Basic reports

### 2.2 What's OUT (deferred to Full Product)

- PhonePe PG (real payments)
- Shiprocket (real shipping)
- WhatsApp BSP integration
- MSG91 SMS + OTP (email OTP placeholder in MVP)
- Meta Pixel + CAPI
- Meta Lead Ads webhook
- GST invoice PDF generation
- Abandoned cart recovery
- Reviews with photos
- Attribution dashboard
- Advanced promotions (BOGO, tiered)

This sequencing means the MVP is testable end-to-end without external setup work (DLT registration, Meta App Review, WhatsApp template approval, PhonePe onboarding all happen during Phase 1, ready to plug in at start of Phase 2).

---

### Sprint 0 — Foundation (Week 1)

**Goal:** Project scaffolding, dev environments running, CI green.

**Tasks:**

- Monorepo setup (Turborepo + pnpm workspaces) with packages: `storefront`, `admin`, `api`, plus shared `db`, `ui`, `types`, `config`
- Storefront and admin: Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- API: NestJS + TypeScript + Prisma
- PostgreSQL 16 + Redis 7 via Docker Compose for local dev
- Object storage abstraction (local filesystem for MVP; same interface used later for R2/S3)
- Prisma schema initialized with `Settings` table; full schema added incrementally per sprint
- Linting (ESLint v9 flat config), formatting (Prettier), pre-commit hooks (Husky + lint-staged optional)
- CI on GitHub Actions: lint, typecheck, build, with Postgres service container
- Sentry SDK installed but DSN optional (no-op without it)
- Environment config: `.env.example` files at repo root, validated env loader in each app
- README with full setup instructions

**Acceptance:** Any dev clones repo, runs `pnpm install && pnpm docker:up && pnpm db:migrate && pnpm db:seed && pnpm dev`, and has storefront (port 3000), admin (port 3001), and API (port 4000) all running locally with a working DB.

---

### Sprint 1 — Data foundations & admin auth (Week 2)

**Goal:** Core data models exist; admin can log in.

**Database (Prisma migrations):**

- `AdminUser` (email, password hash, role, TOTP secret, last_login_at, is_active)
- `Customer` (phone, name, email, denormalized stats, marketing consent flags)
- `Address` (linked to customer, billing/shipping types)
- `Category` (self-referencing tree)
- `Product` (with availability_flag, HSN, GST rate placeholders)
- `ProductVariant` (with stock_count, low_stock_threshold)
- `ProductCategory` (join)
- `InventoryEvent` (audit log)
- `AuditEvent` (admin action log)
- `Setting` (key-value)

**Backend:**

- Admin auth module: email + password (bcrypt), JWT access + refresh tokens, secure cookie storage
- TOTP 2FA enrollment + verification using `speakeasy` or similar
- Audit log middleware to record every admin action
- Seed script: one admin user, baseline settings (shipping threshold, return window, low-stock threshold, etc.)

**Admin UI:**

- Login screen (email + password + TOTP)
- TOTP enrollment screen for first login
- Shell layout: top bar with user menu, mobile bottom nav placeholder, desktop sidebar
- Empty dashboard route
- Logout

**Acceptance:** Run seed → log in as admin → see empty dashboard. Wrong TOTP fails with clear error. Audit log row recorded for every login.

---

### Sprint 2 — Catalog management (Week 3)

**Goal:** Admin can manage products end-to-end. No storefront yet.

**Backend:**

- Categories CRUD with tree operations (add child, reparent, reorder, soft-delete)
- Products CRUD with variants
- Variant matrix endpoint (given size axis + color axis → returns variant rows to create/update)
- Image upload endpoint → local filesystem (interface allows swap to R2/S3 later)
- Inventory adjustment endpoint with required reason
- `InventoryEvent` audit log writes on every change

**Admin UI:**

- Products list (table on desktop, card list on mobile)
- Product create/edit form with tabs: Basics, Variants, Images, Categories, SEO, GST, Availability
- Variant matrix builder (visual grid)
- Image gallery editor (drag to reorder, alt text per image)
- Categories management (tree view with drag-and-drop on desktop, nested list on mobile)
- Inventory page: list of variants with stock, low-stock filter, audit log per variant

**Acceptance:** Admin can create a product with 3 sizes × 2 colors = 6 variants, upload 4 images, assign to 2 categories, set HSN and GST rate, set stock per variant, mark availability as `online_shippable`. Stock adjustments write audit log rows.

---

### Sprint 3 — Storefront catalog (Week 4)

**Goal:** Customers can browse the catalog. No cart yet.

**Backend:**

- Public catalog endpoints (paginated, filtered): list products, get product by slug, list categories, get category tree
- Filter & search: by category, size, color, price range, full-text on product name/description
- Pincode serviceability endpoint (reads owner-managed allowlist from `Settings`)

**Storefront UI:**

- Home page (hero, featured categories, featured products, trust strip, footer)
- Category landing page (filter bar, product grid, sort)
- Product detail page (PDP) with:
  - Image gallery with prev/next navigation
  - Variant selectors (size pills + color swatches)
  - Delivery estimate widget (three states: serviceable / not serviceable / not entered)
  - Description tabs
  - Reviews section placeholder
  - Related products
  - Sticky add-to-cart on mobile (button disabled — no cart yet)
- Search results page
- Pincode capture: first-visit modal + persistent in localStorage + PDP widget
- Static pages: size guide, terms, privacy, returns, shipping, contact
- Header, footer, navigation components
- 404 page

**Acceptance:** Customer browses home → category → PDP, changes variants, enters pincode and sees delivery estimate change, searches, sees in-store-only products with WhatsApp CTA (just `wa.me/` link for MVP).

---

### Sprint 4 — Cart & checkout flow with mock payment (Week 5)

**Goal:** Customer can complete a purchase end-to-end with a mock payment.

**Backend:**

- Cart model + endpoints: create, read, update item, remove item, apply coupon
- Coupon validation logic (simple: code, validity window, usage limits, minimum cart total)
- Order creation endpoint:
  - Validates cart, locks pricing
  - Creates Order in `placed` state
  - Decrements stock atomically inside transaction
  - Returns mock payment session token
- **Payment provider interface** with implementations:
  - `MockPaymentProvider` — auto-succeeds after 2s delay; toggleable to fail in admin settings
  - `PhonePePaymentProvider` — stub class, throws `NotImplemented` (placeholder for Phase 2)
  - Future provider slots stay open (Razorpay/Cashfree if needed later)
- Mock webhook endpoint simulating a payment webhook for `payment.captured` / `payment.failed`
- On `payment.captured`: order moves to `confirmed`, transactional email queued
- Idempotency on order creation (client-generated key)

**Storefront UI:**

- Cart page (line items, quantity controls, coupon entry, free-shipping nudge, totals)
- Multi-step checkout:
  - Step 1: Address (phone, name, email optional, full address, pincode confirmation)
  - Step 2: Shipping method display (single mock method with ETA and fee)
  - Step 3: Payment/Review (mock payment UI: "Pay ₹X" button that calls mock provider)
- Order success page with order number
- Cart persistence in localStorage + server sync after phone capture

**Email (basic, transactional):**

- Resend account configured (free tier, ~100/day)
- Order confirmation email template (React Email)
- Sent on `payment.captured` event

**Acceptance:** Customer completes checkout from empty cart → product added → checkout steps → mock payment success → order success page → confirmation email received. Order appears in admin with `confirmed` status.

---

### Sprint 5 — Order lifecycle & admin ops (Week 6)

**Goal:** Admin can process orders through full lifecycle.

**Backend:**

- Full order state machine with explicit transitions:
  `placed → confirmed → packed → shipped → out_for_delivery → delivered`
  Plus branches: `cancelled`, `return_requested`, `returned`, `refunded`, `payment_failed`
- Order events / audit log on every transition
- Admin endpoints: list orders (filterable), get order detail, transition state, cancel, refund (mock)
- Customer-initiated cancellation (until `packed` state)
- **Shipping provider interface** with `MockShippingProvider` (returns fake AWB, auto-progresses status with simulated delays)
- `ShiprocketShippingProvider` — stub class for Phase 2
- Refund endpoint with admin approval gate:
  - Staff initiates refund request → enters `pending_admin_approval` state
  - Admin sees in queue → approves → mock refund issued
- Settings to toggle: `MOCK_PAYMENT_AUTO_SUCCEED`, `MOCK_SHIPPING_AUTO_PROGRESS_TIMINGS`

**Admin UI:**

- Orders list (filterable by state, searchable by order number/customer/phone)
- Order detail page:
  - Full order info, customer, address, items, payment
  - State transition buttons (contextual: Mark packed → Mark shipped → etc.)
  - Generate label button (downloads dummy PDF for MVP)
  - Timeline / audit log section
  - Internal notes
- Refund approval queue (Admin only)
- Mobile-optimized: card-style order list, sticky action bar on detail

**Storefront UI:**

- Order tracking page (`/track/[id]?token=...`)
- 3-stage timeline display (Placed → Shipped → Delivered)
- Contextual cancel CTA (until packed)
- Order details
- Invoice download placeholder ("Coming soon" — real PDF in Phase 2)

**Acceptance:** Admin transitions a test order through `placed → confirmed → packed → shipped → delivered`. Customer can self-cancel from tracking page while in `confirmed` state. Staff requests a refund → Admin approves → refund recorded.

---

### Sprint 6 — Returns & exchanges (Week 7)

**Goal:** Customer can request returns; admin can process them end-to-end.

**Database:**

- `ReturnRequest` and `ReturnLineItem` tables
- Add `reserved_for_exchange` count to `ProductVariant`

**Backend:**

- Customer-facing endpoints:
  - Get returnable items for an order (eligible window, returnable products)
  - Create return request (with line items, reasons, photos, method, exchange variants)
  - Cancel return request
- Photo upload for damaged/quality reasons (local filesystem for MVP)
- Admin endpoints:
  - List return requests (filtered)
  - Get detail
  - Approve / reject
  - Mark received / verified with condition + restock decision
  - Trigger refund (uses same admin-approval flow from Sprint 5)
- Exchange flow: variant reservation logic; auto-expire after 14 days
- Replacement flow: with the configurable "keep-it threshold" setting
- Return state machine with full transitions and audit log

**Storefront UI:**

- "Return / Exchange" button on order tracking page (visible when delivered + within window)
- Multi-step return request flow:
  1. Select items
  2. Reason per item (with photo upload for damaged/quality)
  3. Action per item (return/exchange/replacement; variant picker if exchange)
  4. Return method (courier pickup / store dropoff)
  5. Confirmation with reference number

**Admin UI:**

- Returns queue (card list with photo thumbnails)
- Return detail page:
  - Items, reasons, photos (tap to enlarge)
  - Verification panel: condition picker, restock decision, staff notes
  - Action buttons (approve, mark received, mark verified, trigger refund)
- Store dropoff lookup: admin searches by reference number to find walk-in return

**Acceptance:** Customer requests a return with photos → admin sees in queue → approves → marks received → marks verified with condition → requests refund → admin approves refund → all state transitions logged. Exchange flow reserves replacement variant stock.

---

### Sprint 7 — Coupons & promotions engine (Week 8)

**Goal:** Coupon codes and basic automatic promotions work.

**Database:**

- `Promotion` (conditions, actions, validity, stackable flag, priority)
- `Coupon` (code, promotion_id, usage limits, validity)
- `CouponUsage` (per-customer usage tracking)

**Backend:**

- Promotion engine module:
  - Condition evaluators: cart subtotal ≥ X, contains product, contains category, customer is first-time, date range, pincode in list
  - Action appliers: % off order, flat off order, free shipping, % off specific products/categories
  - Stacking logic with priority ordering
  - Cart re-evaluation on every change
  - Application snapshot frozen at order placement
- **Deferred for Phase 2:** BOGO, tiered (buy N pay M), buy-X-get-Y mechanics
- Admin endpoints: list / create / edit / activate promotions and coupons
- Coupon validation endpoint for cart

**Storefront UI:**

- Coupon entry on cart and checkout review
- Applied discount display with remove option
- Automatic promotion applied silently with explanation tooltip

**Admin UI (Admin role only):**

- Promotions list
- Promotion create/edit:
  - Conditions builder (visual rule editor — add/remove condition rows)
  - Actions builder (simplified for MVP — % off, flat off, free shipping)
  - Stackability + priority
  - Validity dates and usage limits
- Coupon generation (single or bulk codes per promotion)

**Acceptance:** Admin creates promotion "10% off orders ≥ ₹2000 for first-time buyers" → generates code WELCOME10 → customer applies code → discount visible in cart → order placed with frozen discount snapshot.

---

### Sprint 8 — Customer auth, leads, basic reviews (Week 9)

**Goal:** Returning customer login works; lead capture exists; basic reviews work.

**Customer auth (placeholder — no SMS yet):**

- Phone-based OTP login, but **OTP delivered via email** in MVP (configurable target — switches to SMS via MSG91 in Phase 2)
- Tokenized order tracking link (works without OTP for first-time view; OTP required for sensitive actions)

**Leads (manual capture for MVP):**

- `Lead` table with all fields including Meta-specific fields (filled when integration goes live)
- Backend: lead create endpoint (used by manual form for MVP; will be called by Meta webhook in Phase 2)
- Admin: leads inbox with status, notes, WhatsApp link button (just opens `wa.me/<phone>` for now)
- A simple "Contact us" form on storefront that creates a `manual` source lead

**Reviews (text-only for MVP, photos in Phase 2):**

- `Review` table
- Backend: verified-buyer gated submission, admin moderation queue
- Storefront: review form (rating + title + body, no photos) accessible via tokenized link sent post-delivery (in email for MVP, WhatsApp later)
- Storefront: review display on PDP with histogram, sort options
- Admin: reviews moderation queue

**Acceptance:** Returning customer logs in via phone + email-OTP → views past orders. Admin sees a contact-form lead in inbox, marks contacted. Customer leaves text review on a delivered order → admin approves → review appears on PDP.

---

### Sprint 9 — Reports, polish, hardening (Week 10)

**Goal:** MVP is testable, demonstrable, and bug-free for an internal demo.

**Reports (basic):**

- Sales (daily/weekly/monthly revenue, order count, AOV)
- Top products (by units and revenue)
- Top customers
- Returns rate
- CSV export for each

**Polish:**

- Empty states designed everywhere (no empty list without a message)
- Loading skeletons on all primary screens
- Error states (network failures, validation errors, server errors)
- Accessibility audit pass: keyboard nav, focus states, ARIA labels, color contrast
- Performance audit: Lighthouse scores ≥ 85 on key pages (will tighten in Phase 2)
- Mobile testing on real Android (Chrome + Samsung Internet) and iPhone Safari
- Admin mobile testing for ops screens
- Cross-browser smoke test (Chrome, Safari, Firefox)

**Hardening:**

- Rate limiting on auth endpoints, coupon validation, public APIs
- Input validation with Zod on every API endpoint
- Webhook signature stub (will be real in Phase 2 with real services)
- Soft-delete enforcement everywhere
- Audit log coverage check

**Documentation:**

- README updated with full setup
- Runbook: "how to add a product," "how to process a return," "how to issue a refund"
- API documentation generated (NestJS Swagger)
- Decision log: what's mocked, what's real, where the swap points are

**MVP demo prep:**

- Seed data: 30 realistic products with variants, 5 categories, sample orders in various states, sample returns, sample coupons
- Toggle script to walk through happy path for a demo

**Acceptance:** Internal demo run-through works end-to-end without bugs. Owner can drive a complete customer journey + admin journey from setup to refund.

---

### End of Phase 1 milestone

Fully functional ecommerce platform running locally / on staging, missing only real third-party integrations. Owner can show it to investors, advisors, design reviewers — it's a real product. Decision point: proceed to Phase 2 immediately, in parallel with Phase 2 design polish, or gather feedback first.

---

## 3. Phase 2 — Full Product

**Target:** ~8 weeks with 2–3 developers full-time.

### 3.1 Goal

Replace MVP placeholders with real production integrations and add remaining feature breadth. By the end, the product is launch-ready.

### 3.2 Pre-Phase 2 setup (start during Phase 1 Sprints 7–9)

Don't wait until Phase 2 starts. These have lead times.

- **PhonePe PG account** — register business, KYC (PAN, GSTIN, bank verification, current account proof), get sandbox + production credentials. Onboarding usually takes 3–7 working days. **Confirm zero-fee promotional pricing terms in writing** during onboarding.
- **Shiprocket account** — register, KYC, configure pickup address, negotiate rates
- **MSG91 account + DLT registration** — DLT alone takes 1–2 weeks; submit templates for OTP and order notifications
- **WhatsApp Business API via BSP** (Interakt / AiSensy / Gallabox) — select vendor, onboard, submit ~10 templates for approval (24–48h each)
- **Meta App for Lead Ads** — create app, submit for App Review with `leads_retrieval` permission (1–3 weeks)
- **Domain + SSL** — purchase domain, configure DNS, SSL via Let's Encrypt or Cloudflare
- **Email sender domain** — DKIM / SPF / DMARC for Resend on your domain
- **CA consultation** — confirm HSN codes per product category, GST rates, invoice format
- **Object storage** — Cloudflare R2 account, bucket setup
- **GSTIN, legal name, store address** finalized for invoices and policies

---

### Sprint 10 — Real payments via PhonePe PG + GST invoice (Week 11)

This is the most-changed sprint vs the Razorpay version. Allow **3–5 day buffer** beyond what you would for Razorpay because PhonePe PG's developer ecosystem is less mature.

**PhonePe PG integration:**

- Implement `PhonePePaymentProvider` against the existing payment interface
- **PhonePe's checkout integration model** — confirm with the agency:
  - PhonePe offers SDK-less (redirect-based) integration as default — customer redirected to PhonePe's hosted payment page, then redirected back to your callback URL
  - SDK-based integration is available for higher polish but adds complexity
  - **For your scope, SDK-less is the right pick** — simpler, faster to build, supports all payment methods (UPI, cards, net banking) on PhonePe's page
- **API endpoints to integrate:**
  - **Initiate payment:** backend POSTs order details + unique `merchantTransactionId` + redirect URL + callback URL → PhonePe returns a redirect URL → customer goes there
  - **Status check:** backend polls PhonePe's status endpoint with `merchantTransactionId` after redirect-back, as backstop to the webhook
  - **Refund:** backend POSTs refund request with original transaction ID → PhonePe processes → webhook confirms
- **Webhook handler:**
  - PhonePe sends a callback to your registered URL with payment status
  - **Webhook signature verification:** PhonePe uses an `X-VERIFY` header with a SHA256 hash of payload + endpoint + salt — implement carefully; get it wrong and you accept unverified payments
- **Order flow with PhonePe:**
  1. Customer clicks "Pay" → backend creates Order in `placed` state, generates `merchantTransactionId`
  2. Backend calls PhonePe initiate API → gets redirect URL
  3. Customer redirected to PhonePe's hosted payment page
  4. Customer pays (UPI/card/net banking) on PhonePe's page
  5. Customer redirected back to your callback URL with status
  6. PhonePe webhook posts authoritative status to your backend
  7. Backend verifies webhook signature, transitions order to `confirmed` or `payment_failed`
  8. Backstop: backend polls PhonePe status API after redirect-back to confirm
- **UPI intent flow on mobile:** PhonePe's payment page auto-detects UPI apps installed on the customer's phone and offers one-tap UPI app launch (no manual VPA entry). This is PhonePe's killer feature for mobile conversion — verify it works in testing.
- **Idempotency** via `merchantTransactionId` (your unique key per order attempt)
- **Test thoroughly with PhonePe sandbox** — sandbox UPI test numbers, sandbox card details, simulated failure scenarios. Sandbox is less polished than Razorpay's; expect some friction.
- **Switch toggle:** `PAYMENT_PROVIDER=mock | phonepe` in env

**PhonePe gotchas the team should plan for:**

- Onboarding paperwork is more involved than Razorpay's — get this started in Sprint 7 of Phase 1, not the day before Sprint 10
- PhonePe's docs have improved but still have inconsistencies; expect 2–3 small surprises during integration. Support is responsive but ticket-based.
- The redirect-based flow means the "thank you" page should handle three cases: (a) successful redirect with payment success, (b) successful redirect with payment failure (show retry option), (c) customer never returned (rely on webhook + a background reconciliation job that polls PhonePe for pending transactions every 5 minutes for the first hour after order placement)
- **The promotional zero-fee pricing** — read the contract carefully. Often these promos are "first 6 months free" or "first ₹X GMV free." Plan for the day it ends.

**GST tax invoice:**

- Server-side PDF generation (Puppeteer or pdfkit or React-PDF)
- Sequential invoice number generator (FY-scoped, gap-free, atomic)
- Full GST-compliant template with HSN codes, place-of-supply, tax breakdown
- Attached to order confirmation email
- Available for download from order tracking page
- Per-FY counter reset

**Acceptance:** End-to-end purchase via PhonePe sandbox. UPI flow opens UPI app directly on mobile (intent flow). Card and net banking work. Webhook signature verified. Order confirmation email includes GST-compliant PDF invoice. Refund issued via PhonePe API end-to-end. Reconciliation job catches a manually-orphaned transaction within 5 minutes.

---

### Sprint 11 — Real shipping (Week 12)

**Shiprocket integration:**

- Implement `ShiprocketShippingProvider` against existing interface
- Token management (refresh every 10 days, cached)
- Serviceability API integrated into pincode check (now: owner allowlist AND Shiprocket coverage)
- Rate calculation API for cart and checkout
- Order push: on order `confirmed`, push to Shiprocket
- AWB generation: admin "Generate label" button → fetches AWB → downloads PDF
- Tracking webhook handler with signature verification
- Webhook events update Order state automatically (`shipped → out_for_delivery → delivered`)
- Periodic reconciliation job (cron, every 4 hours): poll Shiprocket for in-flight shipments as backstop against missed webhooks
- Reverse pickup for courier returns: implement in `createReturn()`
- Switch toggle: `SHIPPING_PROVIDER=mock | shiprocket`

**Acceptance:** Test order pushed to Shiprocket sandbox/test mode. AWB generates and downloads. Test tracking webhook updates order state. Customer return triggers reverse pickup.

---

### Sprint 12 — SMS, WhatsApp, real notifications (Week 13)

**MSG91 SMS integration:**

- OTP delivery (replaces email OTP from MVP)
- Transactional SMS for all order states using DLT-approved templates
- Switch toggle: keep email OTP as fallback if SMS fails

**WhatsApp via BSP:**

- Implement BSP client (vendor-specific; abstracted behind `WhatsAppProvider` interface)
- Template message sending for all order notifications
- Opt-in capture at checkout
- Document message support for invoice fallback when email not provided
- Click-to-WhatsApp links remain plain `wa.me/` (no BSP needed for these)

**Notification routing:**

| State transition | SMS | WhatsApp | Email |
|---|---|---|---|
| Order placed | ✓ | ✓ | ✓ |
| Shipped | ✓ | ✓ | ✓ |
| Out for delivery | — | ✓ | — |
| Delivered | ✓ | ✓ | ✓ |
| Cancelled / refund initiated / refund completed | ✓ | ✓ | ✓ |
| Return requested / received | ✓ | ✓ | — |

**Acceptance:** Place order on staging with real phone → receive SMS + WhatsApp + email at every state transition. Opt-out works.

---

### Sprint 13 — Meta Lead Ads + abandoned cart (Week 14)

**Meta Lead Ads:**

- Facebook App configured with `leads_retrieval` permission (App Review approved by now)
- Webhook endpoint registered with Meta for `leadgen` event
- Webhook handler:
  - Verify signature
  - Fetch full lead data via Graph API using lead_id
  - Create `Lead` record with full attribution (form, ad, ad set, campaign)
  - De-dupe against existing customers by phone
  - Trigger admin notification (in-app + email)
- Admin leads inbox (built in Sprint 8) now receives real leads
- Page Access Token refresh job (every 50 days, before 60-day expiry)

**Abandoned cart:**

- Background job (BullMQ scheduled): scan for carts with phone captured + inactive 30 min → mark `abandoned` → schedule reminder at +2h
- 2h reminder: send SMS + WhatsApp templates
- 24h reminder: send second pair if not yet recovered
- Stop conditions: customer purchases, opts out, empties cart
- Recovery attribution: link recovered orders back to the abandoned cart for reporting

**Acceptance:** Submit Meta lead form on a test ad → lead appears in admin within seconds with full attribution. Abandon a cart on staging → receive both reminders at correct intervals via SMS and WhatsApp.

---

### Sprint 14 — Analytics: Meta Pixel + CAPI + attribution dashboard (Week 15)

**Meta Pixel (client-side):**

- Standard events: PageView, ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase, Lead
- Event_id generated client-side for dedup with CAPI
- Pixel cookie capture (`fbp`)
- Click ID capture (`fbc` from URL `fbclid`)

**Meta Conversions API (server-side):**

- All same events fired from backend
- **Purchase event specifically fires from PhonePe webhook handler** — immune to ad-blockers and browser close
- Hashed customer match keys: email, phone, name, IP, user agent
- Event_id matches client-side for dedup
- Test Events tool verification (target EMQ score ≥ 7)

**Attribution capture:**

- UTM capture on landing → session storage
- fbclid capture → session storage
- First-touch + last-touch frozen on order at placement
- **PhonePe-specific note:** the redirect-based PhonePe flow means the customer leaves your domain during payment. UTM/fbclid must be stored server-side (linked to cart/order) before the redirect, not just in session storage — otherwise it's lost on redirect-back.

**In-admin attribution dashboard:**

- Date range filter
- First-touch / last-touch toggle
- Grouped hierarchical view: source → medium → campaign → ad set → ad
- Columns: sessions, orders, revenue, AOV, conversion rate
- Drill-down expansion
- CSV export
- Disclaimer text re: Meta Ads Manager differences

**Acceptance:** Test purchase fires Pixel and CAPI events with matching event_ids visible in Meta Test Events. EMQ score on Events Manager ≥ 7. Attribution dashboard shows test traffic by UTM and campaign.

---

### Sprint 15 — Reviews with photos + remaining promo mechanics (Week 16)

**Reviews with photos:**

- Photo upload component on review form (up to 3 photos, client-side compression, EXIF strip)
- Object storage upload (R2) via signed URLs
- Admin moderation now includes photo previews
- PDP review section shows customer photo gallery

**Remaining promotion mechanics:**

- BOGO (buy X get Y free/discounted): cheapest-qualifying-item logic
- Buy N pay M variant
- Add free product to cart action
- Tiered conditions (quantity-based)
- Customer segment conditions (repeat buyers, specific tags)

**Object storage migration:**

- Migrate MVP local-filesystem images and PDFs to R2
- Update upload pipeline to write directly to R2 via signed URLs
- CDN setup (Cloudflare R2 includes CDN)

**Acceptance:** Customer leaves a review with photos → admin approves → review with photo gallery visible on PDP. BOGO promotion configured by admin works correctly on cart. All MVP-era images served from R2 via CDN.

---

### Sprint 16 — Performance, accessibility, SEO hardening (Week 17)

**Performance:**

- Next.js Image component everywhere with proper `sizes`, AVIF/WebP, blur placeholders
- ISR (Incremental Static Regeneration) on category and product pages with revalidation on changes
- Bundle analysis + tree-shaking pass; target initial JS < 150KB gzipped
- Critical CSS inlining
- Font subsetting
- Lighthouse CI in pipeline with thresholds (Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 90)
- Target: LCP < 2.5s on simulated 4G

**Accessibility (WCAG AA verification):**

- Full audit with axe DevTools and manual keyboard testing
- Screen reader smoke test (VoiceOver iOS, TalkBack Android)
- Focus state design review across every interactive element
- Color contrast verification using tooling
- Form labels and error association
- Skip-to-content links
- ARIA live regions for cart updates, toast notifications

**SEO:**

- Per-page dynamic title and meta description from CMS-style settings
- JSON-LD `Product` structured data on PDPs
- JSON-LD `Organization` and `WebSite` on home page
- OpenGraph + Twitter Card meta on all pages
- `sitemap.xml` auto-generated, revalidated on product/category changes
- `robots.txt`
- Canonical URLs

**Acceptance:** Lighthouse CI passes on every PR. Storefront LCP < 2.5s on 4G mobile (verified via WebPageTest). Axe scan returns zero violations on key pages.

---

### Sprint 17 — Final polish, observability, launch prep (Week 18)

**Observability:**

- Sentry configured with real DSN on storefront, admin, and backend
- Source maps uploaded automatically in CI
- Custom alerts for: PhonePe webhook failures, PhonePe API errors, Shiprocket webhook failures, error rate spikes
- Uptime monitoring on key endpoints (Better Stack / UptimeRobot)
- Slack or email alert routing

**Final features:**

- Low-stock alert emails to owner (configurable threshold)
- End-of-day reconciliation report (auto-generated, emailed to owner)
- Reviews trigger SMS/WhatsApp (post-delivery, configurable delay)
- Admin push notifications (PWA-based) for refund approval requests and new orders
- Legal pages: insert real template content (Terms, Privacy, Returns, Shipping)
- Cookie consent / DPDP-compliant data collection notice

**Final hardening:**

- Penetration test smoke pass: auth bypass attempts, IDOR checks, SQL injection probes, XSS probes
- **PhonePe webhook signature verification re-audit** — get this wrong and you accept fake payment confirmations
- Webhook signature verification on every external webhook
- Secrets audit: no secrets in git, all in env vars or secrets manager
- Rate limit review across all public endpoints
- Database indexing review (slow query log analysis)
- Connection pooling configured

**Launch readiness:**

- Production environment provisioned (hosting decision now or pre-launch)
- Production data seeded (real products from owner's catalog)
- **PhonePe production mode toggled on** (verify promo pricing is active on production account)
- DLT-registered SMS templates approved and live
- WhatsApp templates approved and live
- Meta App in Production (post-App-Review)
- DNS pointed, SSL active
- Owner runbook delivered
- Staff training session
- Soft-launch checklist run-through (place a real ₹1 order via PhonePe end-to-end)

**Acceptance:** Production environment is fully configured. Owner can place a real ₹1 order end-to-end. Real UPI intent flow works on her own phone via 4G. All integrations live and tested. Ready for marketing to drive traffic.

---

### End of Phase 2 milestone

Product is fully launched on PhonePe PG. The first 30 days post-launch should run on the agreed-upon bug-fix support window, then transition to ongoing maintenance.

---

## 4. Cross-cutting development practices

These apply throughout both phases — not separate sprints, but enforced standards.

### 4.1 Testing strategy

- **Unit tests** for business logic (promotion engine, order state machine, inventory calculations, GST math) — high coverage
- **Integration tests** for API endpoints
- **E2E tests** for critical flows (Playwright): happy-path purchase, return flow, admin order processing
- **Manual QA** checklists per sprint for UI work

### 4.2 Code review

- Every PR reviewed by another dev
- No direct commits to `main`
- CI must pass (lint, typecheck, tests, build)
- Lighthouse CI on storefront PRs (Phase 2+)

### 4.3 Branch strategy

- `main` is always deployable
- Feature branches off `main`, short-lived
- Merged via squash commits

### 4.4 Documentation as you go

- README per package
- Inline code comments for non-obvious business logic (promotion engine, GST calc, state machine guards)
- API documented via Swagger
- Decision records (ADRs) for major architectural choices

### 4.5 Demo cadence

- End of every sprint: 30-min internal demo to owner of what shipped
- Owner provides feedback within 48h
- Critical changes scoped into next sprint; non-critical into backlog

### 4.6 Environment tiers

- **local** — devs run everything on their machines
- **staging** — shared, internet-accessible, mirror of production config but with test-mode integrations
- **production** — live, real money, real customers (only post-Phase 2)

---

## 5. Timeline summary

| Phase | Sprint | Week | Theme |
|---|---|---|---|
| 1 — MVP | 0 | 1 | Foundation |
| 1 — MVP | 1 | 2 | Data + admin auth |
| 1 — MVP | 2 | 3 | Catalog management |
| 1 — MVP | 3 | 4 | Storefront catalog |
| 1 — MVP | 4 | 5 | Cart + checkout (mock payment) |
| 1 — MVP | 5 | 6 | Order lifecycle + admin ops |
| 1 — MVP | 6 | 7 | Returns + exchanges |
| 1 — MVP | 7 | 8 | Coupons + basic promotions |
| 1 — MVP | 8 | 9 | Customer auth, leads (manual), reviews (text) |
| 1 — MVP | 9 | 10 | Reports + polish + hardening |
| **MVP complete** | | | **Demonstrable product, no real integrations** |
| 2 — Full | 10 | 11 | PhonePe PG + GST invoice *(+3–5 day buffer)* |
| 2 — Full | 11 | 12 | Shiprocket |
| 2 — Full | 12 | 13 | SMS + WhatsApp + real notifications |
| 2 — Full | 13 | 14 | Meta Lead Ads + abandoned cart |
| 2 — Full | 14 | 15 | Meta Pixel + CAPI + attribution dashboard |
| 2 — Full | 15 | 16 | Photo reviews + remaining promotions + R2 migration |
| 2 — Full | 16 | 17 | Performance + accessibility + SEO hardening |
| 2 — Full | 17 | 18 | Observability + launch prep |
| **Full Product complete** | | | **Launch-ready on PhonePe** |

**Total: ~18 weeks (~4.5 months)** with 2–3 devs working full-time. Buffer of 1–2 weeks for unplanned work, holidays, design review cycles.

---

## 6. How to use this plan

- Each sprint is sized for one calendar week with a small team — assume some slip; 1.2–1.5× buffer in real planning is wise
- "Acceptance" criteria per sprint are the gate; don't move on until they pass
- **Pre-Phase-2 setup tasks must start during Sprints 7–9** of Phase 1 — otherwise Phase 2 stalls in week 11 waiting on external approvals
- PhonePe PG onboarding specifically should start in Sprint 7 to give time for KYC and contract review before Sprint 10
- The MVP → Full transition is a natural pause point for: owner feedback, agency review, design iteration, fundraising milestone, or just a breather before the integration sprint
- Open items from the architecture doc (promotion spec, hosting choice, pincode list) need to land by their flagged sprint or that sprint slips
- If the PhonePe promotional pricing terms are unfavorable (e.g., promo expires too soon, or unrealistic GMV cap), revisit the gateway choice before Sprint 10 — your `PaymentProvider` interface makes this a 1-sprint switch to Razorpay if you change your mind

---

## 7. Risk register

Decisions that carry known trade-offs, made consciously by the owner, summarized for visibility:

| Risk | Decision | Mitigation |
|---|---|---|
| Overselling from manual stock discipline lapses | Strict manual real-time updates | Fast mobile UI, low-stock alerts, end-of-day reconciliation, audit log |
| Data loss from limited backups | Hosting-default backups only | Soft-deletes, audit logs, Git for code, secrets in a manager |
| Conversion loss from prepaid-only | No COD | Revisit at 60–90 days based on cart abandonment data by pincode |
| Higher return abandonment from 7-day window | Tight return window | Monitor returns metrics; extend if needed |
| DPDP non-compliance from template Privacy Policy | Template at launch | Lawyer review within 90 days; flagged as compliance debt |
| Meta App Review delay blocks Lead Ads | App Review takes 1–3 weeks | Submit during Phase 1, well before Phase 2 launch dependency |
| Shiprocket API friction | Single provider at launch | `ShippingProvider` interface for swap-out; periodic webhook reconciliation job |
| PhonePe ecosystem maturity | Primary payment gateway | `PaymentProvider` interface allows Razorpay fallback; +3–5 day buffer in Sprint 10 |
| PhonePe promotional pricing expiry | Lower fees now | Verify contract terms; budget for standard pricing post-promo |

---

*End of document.*
