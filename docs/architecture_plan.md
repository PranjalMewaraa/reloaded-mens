# Architecture Plan — Menswear Ecommerce Platform

**Status:** v2 — pre-build specification (revised post-decisions)
**Audience:** Owner, development team, technical reviewers
**Last updated:** May 17, 2026
**Companion docs:** `implementation_plan.md`

---

## 0. Document purpose

This is the complete architecture and product specification for a custom-built ecommerce website for a mid-market men's clothing brand based in India. It captures every product, technical, and operational decision made during planning, the rationale behind each, and the open items to be settled before build kickoff.

It functions as:

- The single source of truth that the development team builds against
- A contract reference — scope is defined here
- A living document that gets revised as decisions evolve

This document does not include visual design (that lives in Figma) or commercial terms (those live in contracts).

**Version 2 changes from v1:** Payment gateway switched from Razorpay to PhonePe PG. Hosting decided as VPS (Hetzner + Cloudflare). Monorepo scaffolded with Turborepo + pnpm + Node 22. All other decisions unchanged.

---

## 1. Context

### 1.1 The business

A men's clothing retailer currently operating primarily through a physical store, with social presence on Instagram and Meta advertising driving discovery. The website launching alongside this is a new sales channel intended to capture online demand and route some Meta-driven traffic into direct online orders.

### 1.2 Positioning

- **Segment:** Mid-market men's clothing
- **Average order value:** ₹1500–3000
- **Customer expectations:** Quality photography, clear product information, fast and reliable checkout, easy returns. Not premium / white-glove, but materially better than fast-fashion budget players.

### 1.3 Scale at launch

- **SKUs:** Under 100 at launch (with room to grow)
- **Orders:** Under 10 per day at launch (with growth expected)
- **Pincodes served:** Owner-selected serviceable pincodes in specific cities/regions. Not pan-India.

### 1.4 Build context

- **Team:** Small team of 2–3 developers (in-house or agency)
- **Budget posture:** Bootstrapped on running costs. Architecture favors free / cheap tiers and self-hosted where the engineering effort tradeoff is acceptable.
- **Timeline:** Quality over speed. No hard launch deadline. ~18 weeks targeted (~4.5 months).
- **Build approach:** Custom-coded throughout. No Shopify, no Medusa, no SaaS ecommerce platform. Third-party services integrated only for payments, shipping, messaging, and analytics — storefront, admin, and backend are custom.

---

## 2. System overview

### 2.1 Architecture at a glance

Three frontends, one backend, one primary database, several integrated third-party services.

```
+--------------------+   +--------------------+   +--------------------+
|     Storefront     |   |    Admin panel     |   |  POS (deferred)    |
|   (Next.js, web)   |   |   (Next.js, web)   |   |  (Phase 2+)        |
+----------+---------+   +---------+----------+   +----------+---------+
           |                       |                         |
           +---------+-------------+-------------------------+
                     |
                     v
           +--------------------+
           |   Backend API      |
           |   (NestJS, Node)   |
           +----+---------------+
                |
                +-----> PostgreSQL (primary data store)
                +-----> Redis (cache, sessions, job queue)
                +-----> Object storage (R2 — images, invoices, return photos)
                +-----> External integrations:
                          - PhonePe Payment Gateway
                          - Shiprocket (shipping)
                          - MSG91 (SMS, OTP)
                          - WhatsApp BSP (notifications)
                          - Meta Pixel + CAPI (analytics)
                          - Meta Lead Ads webhook (lead capture)
                          - Resend (transactional email)
```

### 2.2 Technology stack

| Layer | Technology | Rationale |
|---|---|---|
| Storefront | Next.js 15 (App Router) + TypeScript + Tailwind CSS | Server components for SEO and LCP; mature ecosystem; team familiarity. |
| Admin panel | Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui | Same stack as storefront to share code. |
| Backend API | NestJS (Node + TypeScript) | Opinionated structure that scales with codebase; modular by design. |
| ORM | Prisma | Type-safe, mature, strong migration story. |
| Database | PostgreSQL 16+ | Industry standard; ACID; rich indexing. |
| Cache & queue | Redis 7 + BullMQ | Background jobs (notifications, webhooks, abandoned cart timers). |
| Object storage | Cloudflare R2 | Cheap, durable, signed URL support, free egress. |
| Email | Resend (transactional) | Free tier covers launch; React Email templates. |
| SMS + OTP | MSG91 | India-native; DLT-compliant; standard pick. |
| WhatsApp | BSP — Interakt, AiSensy, or Gallabox | Required for WhatsApp Business API access. To be selected. |
| Payments | PhonePe Payment Gateway | Best-in-class UPI success rates; promotional zero-fee pricing for new merchants; market-leading UPI share (48%+). |
| Shipping | Shiprocket | Multi-courier aggregator; AWB and tracking webhook support. |
| Analytics | Meta Pixel + Meta CAPI | Server-side conversion tracking immune to ad-blockers. |
| Error monitoring | Sentry | Free tier; standard for Node/Next.js. |
| Hosting | Hetzner VPS + Cloudflare | Cheapest reliable VPS + free CDN/SSL/DDoS. |
| Monorepo | Turborepo + pnpm workspaces | Fast, simple, well-supported. |
| Node | 22 LTS | Current LTS. |

### 2.3 Cross-cutting principles

- **Mobile-first storefront and mobile-friendly admin** (key admin screens designed mobile-first)
- **TypeScript everywhere.** No untyped boundaries.
- **All boundaries validated.** Zod on every API input and external service response.
- **Idempotency on every state-changing API.** Especially order creation, payment confirmation, refund issuance.
- **Soft-deletes by default.** No hard `DELETE` on Products, Orders, Customers, Leads, Returns. `deleted_at` timestamp; views filter automatically.
- **Audit log for all admin actions and state transitions.** Append-only `events` tables on Orders, Returns, Inventory.
- **Webhook-first for external services.** State transitions are driven by webhooks, not by polling or by client-side success callbacks.
- **No hard-coded business config.** Pricing rules, shipping thresholds, return windows, etc. live in a `settings` table editable from admin.
- **Provider interfaces for swappable services.** Payment, shipping, WhatsApp, email all behind interfaces so swap is a contained refactor.

---

## 3. Monorepo structure

The project is organized as a Turborepo monorepo with pnpm workspaces. Single repo, single CI, single deployment pipeline.

```
menswear-monorepo/
├── apps/
│   ├── api/          NestJS backend API (port 4000)
│   ├── admin/        Admin panel — Next.js (port 3001)
│   └── storefront/   Customer storefront — Next.js (port 3000)
├── packages/
│   ├── config/       Shared ESLint + tsconfig presets
│   ├── db/           Prisma schema, client singleton, migrations, seed
│   ├── types/        Shared TypeScript enums + Zod schemas
│   └── ui/           Shared React components
├── docker-compose.yml   Local Postgres + Redis
├── turbo.json           Turborepo pipeline config
└── pnpm-workspace.yaml  Workspace globbing
```

Apps import workspace packages via `@repo/<name>`:

```typescript
import { prisma } from '@repo/db';
import { phoneSchema, ORDER_STATE } from '@repo/types';
import { Button, cn } from '@repo/ui';
```

Next.js apps use `transpilePackages` to consume workspace TypeScript directly without a build step during dev.

---

## 4. Data model

### 4.1 Core entities

Conceptual model. Field names illustrative; team may refine.

#### Category

Self-referencing tree.

- `id`, `slug`, `name`, `description`
- `parent_id` (nullable for top-level)
- `image_url`, `sort_order`, `is_active`
- `seo_title`, `seo_description`
- `created_at`, `updated_at`, `deleted_at`

#### Product

Shared envelope around variants.

- `id`, `slug`, `name`, `description`
- `hsn_code`, `gst_rate_percent` (for GST invoicing)
- `availability_flag`: enum (`online_shippable`, `in_store_only`, `both`)
- `base_price_paisa`, `compare_at_price_paisa` (MRP)
- `cost_price_paisa` (Admin-only visibility)
- `is_active`, `is_returnable`
- `images`: array of `{ url, alt, sort_order }`
- `seo_title`, `seo_description`, `og_image_url`
- `created_at`, `updated_at`, `deleted_at`

#### ProductCategory (join)

Many-to-many.

- `product_id`, `category_id`, `sort_order`

#### ProductVariant

Unit of inventory and unit purchased.

- `id`, `product_id`
- `sku` (unique, generated)
- `size`, `color`
- `price_override_paisa` (nullable, falls back to product `base_price_paisa`)
- `stock_count`, `reserved_for_exchange`
- `low_stock_threshold`
- `barcode` (optional)
- `is_active`
- `created_at`, `updated_at`, `deleted_at`

#### Customer

Auto-created on first order or OTP login.

- `id`, `phone` (canonical `+91XXXXXXXXXX`, unique, indexed)
- `name`, `email` (both optional)
- `default_billing_address_id`, `default_shipping_address_id`
- `total_orders`, `total_revenue_paisa`
- `tags` (array)
- `marketing_consent_whatsapp`, `marketing_consent_sms`, `marketing_consent_email` (each with timestamp)
- `created_at`, `updated_at`, `deleted_at`

#### Address

- `id`, `customer_id`
- `name`, `phone`, `line1`, `line2`, `city`, `state`, `pincode`, `country`
- `type`: enum (`billing`, `shipping`, `both`)

#### Order

- `id`, `order_number` (sequential, human-friendly, FY-scoped)
- `customer_id`
- `state`: enum (see §7)
- `payment_state`: enum (`pending`, `paid`, `failed`, `refunded`, `partially_refunded`)
- `subtotal_paisa`, `discount_paisa`, `shipping_paisa`, `tax_paisa`, `total_paisa`
- `applied_promotion_ids` (array, frozen at order placement)
- `applied_coupon_code` (frozen)
- `billing_address`, `shipping_address` (denormalized snapshots)
- `delivery_estimate_at`
- Timestamps per state transition
- `cancel_reason`
- `attribution`: `{ first_touch_utm, last_touch_utm, fbclid, fbp }`
- `phonepe_merchant_transaction_id` (PhonePe's idempotency key)
- `created_at`, `updated_at`, `deleted_at`

#### OrderLineItem

- `id`, `order_id`, `variant_id`
- `product_name`, `variant_label`, `sku` (denormalized snapshot)
- `quantity`
- `unit_price_paisa`, `discount_paisa`, `tax_paisa`, `total_paisa`
- `hsn_code`, `gst_rate_percent`

#### OrderEvent (audit log)

- `id`, `order_id`
- `event_type`: enum
- `actor`: enum (`system`, `customer`, `staff`, `admin`)
- `actor_id` (nullable)
- `payload` (jsonb)
- `created_at`

#### InventoryEvent (audit log)

Every stock change writes a row.

- `id`, `variant_id`
- `change_type`: enum (`store_sale`, `online_order`, `restock`, `return_restock`, `correction`, `write_off`)
- `delta` (signed integer)
- `stock_before`, `stock_after`
- `actor`, `actor_id`, `reference_id`
- `note`, `created_at`

#### ReturnRequest

- `id`, `return_number`, `order_id`, `customer_id`
- `state`: enum (see §10)
- `method`: enum (`courier_pickup`, `store_dropoff`)
- `reference_token` (short-lived, for store dropoff lookup)
- `total_refund_paisa`
- Timestamps

#### ReturnLineItem

- `id`, `return_request_id`, `order_line_item_id`
- `type`: enum (`return`, `exchange`, `replacement`)
- `reason`: enum (`size_issue`, `quality`, `not_as_expected`, `damaged`, `other`)
- `customer_note`, `photos` (R2 URLs)
- `requested_exchange_variant_id`
- `condition_on_receipt`: enum (`pristine`, `used`, `damaged`)
- `restock_decision`: enum (`restock`, `hold`, `write_off`)
- `staff_note`

#### Promotion

- `id`, `name`, `description` (internal)
- `is_active`, `valid_from`, `valid_to`
- `stackable`, `stack_priority`
- `conditions` (jsonb)
- `actions` (jsonb)
- `usage_count` (denormalized)
- Timestamps

#### Coupon

- `id`, `code` (unique, case-insensitive), `promotion_id`
- `is_active`
- `usage_limit_total`, `usage_limit_per_customer`
- `usage_count_total`
- `valid_from`, `valid_to`
- Timestamps

#### Lead

- `id`, `source`: enum (`meta_lead_ads`, `whatsapp`, `website_signup`, `manual`)
- Meta-specific IDs: `meta_lead_id`, `meta_form_id`, `meta_ad_id`, `meta_campaign_id`, `meta_adset_id`
- `name`, `phone`, `email`
- `custom_fields` (jsonb)
- `status`: enum (`new`, `contacted`, `qualified`, `converted`, `lost`)
- `assigned_to_admin_user_id`
- `converted_to_customer_id`
- `notes_history` (array)
- Timestamps

#### Cart

Persistent cart for abandonment tracking.

- `id`, `device_id`, `phone` (captured at checkout)
- `items` (array)
- `applied_coupon_code`
- `state`: enum (`active`, `converted`, `abandoned`)
- `last_activity_at`, `abandoned_at`, `recovered_at`
- `reminders_sent`: array

#### Review

- `id`, `product_id`, `customer_id`, `order_id`
- `rating` (1–5), `title`, `body`
- `photos` (R2 URLs)
- `state`: enum (`pending`, `approved`, `rejected`)
- `helpful_count`
- Timestamps

#### AdminUser

- `id`, `email`, `password_hash`
- `role`: enum (`admin`, `staff`)
- `name`
- `totp_secret`, `totp_enabled_at`
- `last_login_at`, `is_active`
- Timestamps

#### AuditEvent

All admin actions.

- `id`, `admin_user_id`
- `event_type`, `resource`
- `payload` (jsonb)
- `ip_address`, `user_agent`
- `created_at`

#### Setting

Runtime config admin can change without a deploy.

- `key` (unique), `value` (jsonb), `updated_by`, `updated_at`

Examples: `shipping.free_threshold_paisa`, `shipping.flat_fee_paisa`, `returns.window_days`, `returns.replacement_keep_threshold_paisa`, `inventory.low_stock_default_threshold`, `whatsapp.bsp_provider`, `business.gstin`, `business.legal_name`.

---

## 5. Inventory model

### 5.1 The chosen model — strict manual real-time updates

A single unified `stock_count` per variant. Staff is required to decrement stock in the admin panel after every store sale. The website reads from the same field.

Trade-off acknowledged: overselling risk if staff misses an update.

### 5.2 Operational safeguards

- **Quick stock-decrement UI** in admin: sticky search at top, large "−1" button per variant, designed for one-handed counter use
- **Barcode-style fast lookup** by SKU
- **Undo within 60 seconds** of every decrement
- **Low-stock email + WhatsApp alert** to owner when variant drops below threshold
- **End-of-day reconciliation report** auto-generated
- **Audit log** on every change (`InventoryEvent`)
- **Stock locking on order placement** — atomic decrement inside DB transaction; concurrent orders for the last unit fail cleanly

### 5.3 In-store-only products

Products flagged `availability_flag = 'in_store_only'`:

- Shown on storefront
- No Add-to-Cart button
- "Available in our store" badge + click-to-WhatsApp CTA pre-filled with product name
- Stock tracking optional (typically untracked)

Products flagged `availability_flag = 'both'` use normal stock tracking and show both the Add-to-Cart and the "Also available in our store" line.

### 5.4 Future migration path

If/when a POS is introduced at the store, the model evolves to API-driven sync (POS pushes stock decrements via webhook). The data model doesn't change — only the input source for `InventoryEvent` rows.

---

## 6. Storefront

### 6.1 Design and platform

- **Mobile-first** at 360–400px viewports; desktop derived from mobile
- **Built from Figma designs** (owner-supplied)
- **Performance targets:** LCP < 2.5s on 4G mobile, TBT < 200ms, CLS < 0.1
- **Accessibility:** WCAG 2.1 Level AA
- **SEO:** Per-page dynamic meta, OpenGraph, JSON-LD Product on PDPs, sitemap.xml, robots.txt, server-side rendering for catalog pages

### 6.2 Pages

- **Home** — hero, featured categories, featured products, brand story, social proof, store locator block, footer
- **Category landing** (`/c/[slug]`) — filter bar, product grid, sort
- **Subcategory** — nested under parent
- **PDP** (`/p/[slug]`) — gallery, variant picker, price, pincode-aware delivery widget, description, size guide link, related products, reviews
- **Cart** (`/cart`) — line items, quantity controls, coupon, free-shipping nudge, totals
- **Checkout** — multi-step (see §8)
- **Order tracking** (`/track/[order_id]?token=...`) — status, timeline, cancel/return CTAs
- **Search** — query-driven results
- **Size chart** — static page
- **Policy pages** — Terms, Privacy, Returns, Shipping
- **Contact / Store** — address, hours, click-to-WhatsApp, embedded map
- **404** and error pages

### 6.3 Filters

- **Category** (when not on category page), **Size** (multi-select), **Color** (multi-select swatches), **Price range** (slider)
- URL-driven state (`?size=M,L&color=black&price=500-2000`) for shareable filtered views
- Mobile filter UI = slide-up bottom sheet

### 6.4 Pincode and serviceability

- **First-visit prompt** asks for pincode; stored in `localStorage`, valid 30 days
- **PDP delivery estimate widget** with three states: serviceable / not serviceable / not entered
- **Cart** re-validates and shows shipping fee
- **Checkout** confirms one last time before order placement
- **Backend** combines owner-managed allowlist + Shiprocket serviceability API

### 6.5 Reviews

- **Verified-buyer gate** — only orderers within window can review
- **Trigger:** order-delivered event schedules a "rate your purchase" SMS + WhatsApp at +3 days
- **Submission:** star rating + title + body + up to 3 photos (client-side compressed, EXIF stripped, signed-URL upload to R2)
- **Moderation:** every submission enters `pending`; admin approves
- **Display:** rating histogram, sort by helpful/recent, photo gallery, individual review cards
- **Empty state:** hidden for first 30 days, then "Be the first to review"

### 6.6 Size guide

- One generic site-wide chart, accessible from PDPs and footer
- Plain HTML/image content, owner-editable from settings
- Upgrade path: per-category or per-product charts if returns from sizing prove frequent

---

## 7. Order lifecycle

### 7.1 State machine — internal

```
                       +-----------+
                       |  placed   |
                       +-----+-----+
                             |
                             v
                       +-----------+
                       | confirmed |  (after payment captured)
                       +-----+-----+
                             |
                             +-----> cancelled (customer self-serve)
                             |
                             v
                       +-----------+
                       |  packed   |
                       +-----+-----+
                             |
                             v
                       +-----------+
                       |  shipped  |  (AWB generated, courier accepted)
                       +-----+-----+
                             |
                             v
                   +-----------------+
                   | out_for_delivery|
                   +--------+--------+
                            |
                            v
                       +-----------+
                       | delivered |
                       +-----+-----+
                             |
                             v
                  +-------------------+
                  | return_requested  |
                  +---------+---------+
                            |
                            v
                       +-----------+
                       | returned  |
                       +-----+-----+
                             |
                             v
                       +-----------+
                       | refunded  |
                       +-----------+
```

Additional states: `payment_pending`, `payment_failed`, `cancelled`, `rejected`.

### 7.2 Customer-facing view

Customer sees only 3 stages: **Placed → Shipped → Delivered**. Granular internal states drive UI behavior:

- `placed` and `confirmed` → "Placed", with Cancel CTA
- `packed` → "Placed", Cancel hidden, copy switches to "Need help? Chat on WhatsApp"
- `shipped` and `out_for_delivery` → "Shipped", with tracking link
- `delivered` → "Delivered", with Return/Exchange CTA (if within window)
- Terminal states → status message

### 7.3 State transitions

| From | To | Trigger |
|---|---|---|
| (new) | `placed` | Customer completes checkout (pre-payment) |
| `placed` | `confirmed` | PhonePe webhook confirms payment captured |
| `placed` | `payment_failed` | PhonePe webhook reports payment failure |
| `confirmed` | `cancelled` | Customer self-serve OR admin cancel |
| `confirmed` | `packed` | Staff marks order packed |
| `packed` | `shipped` | Staff generates AWB; Shiprocket confirms |
| `shipped` | `out_for_delivery` | Shiprocket webhook |
| `out_for_delivery` | `delivered` | Shiprocket webhook |
| `delivered` | `return_requested` | Customer initiates return |
| `return_requested` | `returned` | Item received and verified |
| `returned` | `refunded` | Refund initiated via PhonePe API |

### 7.4 Cancellation policy

- Self-serve cancel allowed while internal state is `placed` or `confirmed`
- Once `packed`, cancel button disappears; customers route to WhatsApp support
- Self-cancel triggers automatic full refund via PhonePe API (no admin approval for pre-packed cancellation)

### 7.5 Notifications

SMS + WhatsApp on every customer-visible state change, plus email if email is on file.

| State transition | SMS | WhatsApp | Email |
|---|---|---|---|
| Order placed (payment confirmed) | ✓ | ✓ | ✓ + GST invoice PDF |
| Shipped (AWB generated) | ✓ | ✓ | ✓ |
| Out for delivery | — | ✓ | — |
| Delivered | ✓ | ✓ | ✓ |
| Cancelled (refund initiated) | ✓ | ✓ | ✓ |
| Refund completed | ✓ | ✓ | ✓ |
| Return requested | ✓ | ✓ | ✓ |
| Return received | ✓ | ✓ | — |

All WhatsApp messages are utility templates pre-approved via the BSP. SMS via MSG91 with DLT-registered templates. Email via Resend with React Email templates.

---

## 8. Checkout flow

### 8.1 Flow shape

Multi-step, each step a distinct URL:

1. **`/checkout/address`** — name, phone, email (optional), shipping address
2. **`/checkout/shipping`** — shipping method display (single method at launch)
3. **`/checkout/payment`** — review screen + Pay CTA → redirects to PhonePe hosted payment page
4. **`/checkout/callback`** — PhonePe redirects here after payment with status; polls backend
5. **`/checkout/success`** — thank-you page with order number

### 8.2 Auth model

- **Guest checkout by default.** No signup wall.
- Phone number entered at the address step becomes the lookup key for the customer record
- **Backend behavior on phone capture:**
  - If a Customer exists for this phone → link new order to existing customer
  - If not → create new Customer silently
- **No password is ever set.** Returning customer "logs in" via phone OTP only when viewing tracking pages or making changes.

### 8.3 Payments — PhonePe PG

- **Gateway:** PhonePe Payment Gateway
- **Methods enabled:** UPI, cards, net banking, wallets (via PhonePe's hosted page)
- **Methods explicitly emphasized:** UPI (PhonePe's strongest) and cards
- **COD disabled.** Prepaid only.

**Order flow with PhonePe:**

1. Customer clicks "Pay" on checkout review
2. Backend creates `Order` in `placed` state, generates unique `merchantTransactionId`
3. Backend calls PhonePe initiate API with order details, amount, redirect URL, callback URL
4. PhonePe returns a redirect URL
5. Customer redirected to PhonePe's hosted payment page
6. Customer pays (UPI intent flow auto-launches UPI app on mobile)
7. Customer redirected back to `/checkout/callback` with status
8. PhonePe webhook posts authoritative status to backend (with X-VERIFY signature)
9. Backend verifies signature, transitions order to `confirmed` or `payment_failed`
10. Backup: backend polls PhonePe status API for orphaned transactions every 5 min for first hour

**Key design points:**

- **Idempotency:** every checkout attempt has a unique `merchantTransactionId`
- **Webhook signature verification:** SHA256 hash of payload + endpoint + salt in X-VERIFY header — must be implemented correctly
- **Customer leaves your domain during payment** — UTM and attribution data must be stored server-side BEFORE redirect, not just in session storage
- **Three callback scenarios to handle:**
  - Successful redirect with payment success
  - Successful redirect with payment failure (show retry option)
  - Customer never returned (reconciliation job catches via webhook + status polling)

### 8.4 GST handling

- Order totals computed inclusive of GST per HSN code at line-item level
- Tax breakdown shown on review screen and on the GST invoice PDF
- Sequential invoice number (FY-scoped, gap-free, atomic)
- Full GST-compliant invoice generated server-side as PDF
- Attached to order confirmation email; downloadable from tracking page

### 8.5 Cart persistence

- Cart stored in `localStorage` keyed by anonymous `device_id` (UUID)
- Cart contents survive browser close on same device
- When phone is captured at checkout, cart also written server-side (Cart table) — unlocks cross-device sync and powers abandonment tracking
- Cart auto-clears on successful order placement

### 8.6 Coupon entry

- Coupon entry field on cart page and review screen
- Backend validates: code exists, active, within window, customer eligible, conditions met
- Valid coupons → discount line appears
- Automatic promotions apply silently when conditions met

---

## 9. Shipping and fulfillment

### 9.1 Partner

**Shiprocket** as the multi-courier aggregator. Single panel, automatic courier assignment.

### 9.2 Origin

Physical store doubles as fulfillment warehouse. All pickups from store address.

### 9.3 Shipping fees

- **Free shipping above ₹1999**
- **₹99 flat below ₹1999**
- Both stored in `settings`, editable from admin

### 9.4 Integration touchpoints

- **Rate and serviceability API** — called from PDP delivery widget, cart, checkout
- **Order push** — backend creates Shiprocket order when local state moves to `confirmed`
- **AWB / label generation** — admin button → backend calls Shiprocket → PDF download
- **Tracking webhooks** — Shiprocket pings backend on status changes
- **Reverse pickup** — for courier returns when method = `courier_pickup`

### 9.5 Operational notes

- **Pickup window:** fixed daily, e.g., 4–6 PM
- **Hardware:** thermal label printer at store (~₹3–5k one-time)
- **Reconciliation job:** backend polls Shiprocket every 4 hours for in-flight shipments

### 9.6 Shipping provider abstraction

The backend implements a thin `ShippingProvider` interface (`getRates`, `createShipment`, `cancelShipment`, `createReturn`, `getTrackingStatus`) with Shiprocket as the first implementation. Swapping providers is a contained refactor.

---

## 10. Returns and exchanges

### 10.1 Window and policy

- **7 days from delivery** to initiate
- All categories returnable by default; admin can mark specific products non-returnable
- **Reason required** from dropdown (size_issue, quality, not_as_expected, damaged, other)
- **Photo upload required** when reason is `damaged` or `quality`

### 10.2 Three return types

| Type | What happens | Money movement |
|---|---|---|
| **Return** | Item back, refund to original payment method | Refund |
| **Exchange** | Item back, replacement variant of same product shipped | None |
| **Replacement** | New unit of same variant shipped (for damaged-on-arrival) | None |

Mixed types in a single request supported.

### 10.3 Customer flow

After delivery, within window:

1. Tap "Return / Exchange items" on tracking page
2. Select items (checkbox list)
3. Per item: pick reason
4. If reason requires photos: upload up to 3
5. Per item: pick action (return / exchange size / exchange color / replacement)
6. For exchanges: pick new variant from in-stock options
7. Pick method: courier pickup OR store dropoff
8. Confirm → receive reference number via SMS + WhatsApp

### 10.4 Admin flow

- **Returns queue** with state filters
- **Per-request detail:** order, items, reasons, photos, customer's chosen actions
- **Actions:** Approve / Reject / Mark received / Mark verified (condition + restock decision)
- **Refund issuance:** Staff initiates → Admin approves → backend calls PhonePe refund API. Two-eyes control.

### 10.5 Inventory and exchange handling

- **Exchange reservation:** customer requests exchange to variant B → backend decrements available stock on B, tracks under `reserved_for_exchange`
- Reservation auto-expires after 14 days

### 10.6 Drop-at-store returns

- Customer chooses "Drop at store" → reference number + store address/hours
- No Shiprocket reverse pickup
- At store: staff opens admin → searches by reference → verifies → marks received → triggers refund (with admin approval)
- Faster refund; zero reverse-shipping cost; encouraged in UI

### 10.7 Replacement policy

- Damaged items below threshold (`returns.replacement_keep_threshold_paisa`, default ₹500): "keep damaged item, replacement shipped"
- Above threshold: damaged item returned first

---

## 11. Promotions and coupons

### 11.1 Engine model

A `Promotion` defines *what happens*. A `Coupon` is a code that activates a promotion. Same promotion can be activated automatically (conditions met) or via coupon, or both.

### 11.2 Conditions (composable, AND-combined)

- Cart subtotal ≥ X
- Cart contains specific product / category
- Customer is first-time / repeat
- Order date in range
- Customer pincode in list
- Payment method
- Quantity-based

### 11.3 Actions

- % off order total
- Flat amount off order total
- % off specific products / categories
- Flat amount off specific products / categories
- Free shipping
- BOGO (cheapest-qualifying-item logic) — Phase 2
- Buy N pay M — Phase 2
- Add free product — Phase 2

### 11.4 Stacking

- Each promotion has `stackable` boolean + `stack_priority` integer
- Multiple promotions on a cart:
  - All `stackable=true` apply in priority order
  - Among `stackable=false`, only the best-customer-benefit applies
  - Stackable + non-stackable can combine if configured
- Engine logs applied and rejected promotions for audit

### 11.5 Application lifecycle

- Cart change → engine evaluates → applies → shows discount line
- Customer enters coupon → engine validates → applies if valid
- Recalculation on every cart change
- At order placement, applied promotion IDs and coupon frozen on the order

---

## 12. Marketing and messaging integrations

### 12.1 Meta Lead Ads

**Critical at launch.**

1. Owner runs Lead Ads on Facebook/Instagram with native lead forms
2. Meta posts webhooks to backend on every submission
3. Backend fetches full lead data via Graph API
4. Backend writes `Lead` row with full attribution (form, ad, ad set, campaign)
5. De-dupes against existing customers by phone
6. Lead lands in admin's "New leads" inbox with badge
7. Staff opens lead, taps "WhatsApp" → opens WhatsApp pre-filled with customer's number

**Setup:**

- Facebook App with `leads_retrieval`, `pages_manage_metadata`, `pages_show_list` permissions
- App Review (1–3 weeks — plan ahead)
- Long-lived Page Access Token (60-day, refresh every 50)
- Webhook URL registered

### 12.2 WhatsApp Business

**Transactional notifications + abandoned cart utility messages.** No marketing broadcasts at launch.

- **Provider (BSP):** Interakt, AiSensy, or Gallabox — to be selected
- **Templates required at launch** (10 templates, 24–48h approval each):
  - Order placed, shipped, delivered, cancelled, refund initiated, refund completed
  - Return requested, return received
  - Abandoned cart 2h, abandoned cart 24h
  - Review request
- **Opt-in:** "Get order updates and offers on WhatsApp" checkbox at checkout
- **Click-to-WhatsApp** = separate from BSP, plain `wa.me/<store-number>` links

### 12.3 SMS

- **Provider:** MSG91
- **DLT registration mandatory** (1–2 week setup)
- **Use cases:** OTPs, order notifications, abandoned cart

### 12.4 Abandoned cart recovery

- **Trigger:** cart has phone + 30 min of inactivity OR session ends
- **Cadence:** 2h, then 24h
- **Channels:** SMS + WhatsApp utility templates
- **Stop conditions:** customer purchases, opts out, empties cart
- **Tracking:** logged to `Cart.reminders_sent`

### 12.5 Transactional email

- **Provider:** Resend (free tier covers launch)
- **Templates:** React Email — order placed (+ invoice PDF), shipped, delivered, refund initiated, refund completed, return ack, review request
- **GST invoice** attached as PDF to order confirmation
- **Domain setup:** SPF, DKIM, DMARC on sending domain

### 12.6 No marketing email at launch

Explicitly out of scope. SMS + WhatsApp cover that channel.

---

## 13. Admin panel

### 13.1 Users and roles

- **Total users:** 2–4 (owner + 1–3 store staff)
- **Two roles:**
  - **Admin** (owner): full access
  - **Staff** (store team): operational access, no financial or configuration access

### 13.2 Permissions matrix

| Capability | Admin | Staff |
|---|---|---|
| View orders | ✓ | ✓ |
| Transition order states (pack, ship) | ✓ | ✓ |
| Generate shipping labels | ✓ | ✓ |
| Cancel orders | ✓ | ✓ (only `confirmed` state) |
| Issue refunds | ✓ | Request only — Admin approves |
| View products | ✓ | ✓ (read-only on pricing) |
| Create / edit products | ✓ | ✗ |
| Set / change prices | ✓ | ✗ |
| Manage categories | ✓ | ✗ |
| Decrement stock (store sale) | ✓ | ✓ |
| Stock corrections | ✓ | ✓ (logged) |
| Approve return requests | ✓ | ✓ |
| Mark return received / verified | ✓ | ✓ |
| Create / edit promotions | ✓ | ✗ |
| Manage Meta Leads | ✓ | ✓ |
| Moderate reviews | ✓ | ✓ |
| View financial reports | ✓ | ✗ |
| Configure settings | ✓ | ✗ |
| Manage admin users | ✓ | ✗ |

### 13.3 Authentication

- **Email + password**
- **TOTP 2FA mandatory** (Google Authenticator, Authy). No SMS 2FA — SIM swap risk.
- **Session:** 30 days for "remember me" device; re-auth required for sensitive actions
- **Audit log** on all admin actions: who, when, IP, what changed

### 13.4 Mobile-first ops screens

These designed mobile-first because owner uses on phone:

- **Orders list** — swipeable, filterable, quick-action buttons
- **Stock decrement** — counter workflow, big targets, sticky search, one-tap "−1 with undo"
- **Return approval** — card queue, photo preview, single-tap approve/reject
- **Meta Leads inbox** — card queue, big WhatsApp button per lead
- **Refund approval (Admin only)** — push notification → one-tap from phone

Desktop-first screens: deep product editing, promotion creation, analytics, settings.

### 13.5 Sections

- **Dashboard** — today's orders, revenue, low-stock alerts, pending returns, new leads
- **Orders** — list, filters, detail, transitions, label printing, refunds
- **Products** — list, create/edit (variants, images, category, availability, HSN, GST), bulk actions
- **Categories** — manage tree
- **Inventory** — quick decrement view, low-stock alerts, audit log
- **Customers** — list, detail, history, LTV
- **Returns** — queue, detail, approve/reject, receive/verify, refund
- **Promotions & Coupons** (Admin only) — list, create, conditions, actions, usage analytics
- **Leads** — Meta inbox, status, notes, WhatsApp
- **Reviews** — moderation queue
- **Reports** — sales, products, customers, returns (Admin only)
- **Attribution dashboard** — UTM/fbclid first-and-last-touch
- **Settings** (Admin only) — shipping, payment, GST, return policy, integrations
- **Users** (Admin only) — manage admin/staff accounts

---

## 14. Analytics and attribution

### 14.1 Stack

- **Meta Pixel** — client-side standard events
- **Meta Conversions API (CAPI)** — server-side events, deduplicated via `event_id`
- **No Google Analytics**
- **No third-party product analytics at launch**

### 14.2 Events

| Event | Pixel (client) | CAPI (server) |
|---|---|---|
| PageView | ✓ | ✓ |
| ViewContent (product page) | ✓ | ✓ |
| AddToCart | ✓ | ✓ |
| InitiateCheckout | ✓ | ✓ |
| AddPaymentInfo | ✓ | ✓ |
| Purchase | ✓ | ✓ (server-side from PhonePe webhook) |
| Lead (Meta form completion) | ✓ | ✓ |

### 14.3 Purchase event details

Fires server-side from backend immediately after PhonePe webhook confirms payment:

- `event_id` matches pixel-side for dedup
- `value`, `currency`, `content_ids`, `content_type=product`
- Hashed identifiers: `em`, `ph`, `fn`, `ln`
- `fbc` and `fbp` read from session
- `client_ip_address`, `client_user_agent`

Target: EMQ ≥ 7/10.

### 14.4 Attribution capture

- UTM parameters captured on landing
- `fbclid` captured from Meta ad clicks
- Stored server-side BEFORE PhonePe redirect (critical — customer leaves your domain)
- **First-touch + last-touch** frozen on order at placement

### 14.5 In-admin attribution dashboard

- Date range filter
- Group by source / medium / campaign / ad set / ad
- Columns: sessions, orders, revenue, AOV, conversion rate
- Drill-down: campaign → ad set → ad
- Toggle: first-touch / last-touch
- Disclaimer text re: Meta Ads Manager differences

### 14.6 Standard reports

- **Sales** — revenue, orders, AOV, GMV vs net, tax, refunds
- **Products** — top sellers, dead stock, inventory valuation, margin
- **Customers** — top, repeat-buyer rate, new vs returning, LTV cohorts
- **Returns** — rate overall, by product/category, top reasons, refund value
- **Operations** — orders by state, time placed→delivered, cancellation rate

All CSV-exportable. Date-range filter on every report.

---

## 15. Compliance and legal

### 15.1 GST tax invoices

**Launch-scope, fully compliant from day one.**

Every order generates a tax invoice with:

- Business legal name, address, GSTIN
- Sequential invoice number (continuous, FY-scoped)
- Invoice date
- Customer name and billing address
- Customer GSTIN if provided (for B2B sales)
- Line items with HSN code, taxable value, GST rate, GST amount
- Place of supply derived from shipping address state
- Total in figures and words
- Signature placeholder

Generated server-side as PDF (Puppeteer / React-PDF / pdfkit). Attached to order confirmation email. Available for download from tracking page. WhatsApp document fallback when email not provided.

### 15.2 Legal pages

- **Terms of Service** — template at launch
- **Privacy Policy** — template at launch; lawyer-reviewed (DPDP-compliant) within 90 days
- **Return Policy** — template at launch; lawyer-reviewed within 90 days
- **Shipping Policy** — template

All four published before launch.

### 15.3 DPDP Act considerations

Indian Digital Personal Data Protection Act, 2023 applies. Business is a data fiduciary. Required disclosures:

- Purposes of processing
- Retention periods
- Third-party sharing (PhonePe, Shiprocket, Meta, MSG91, BSP, Resend)
- Customer rights (access, correction, erasure)
- Grievance officer contact

### 15.4 Consent capture

- **Marketing consent** captured at checkout via unchecked checkbox; timestamp stored
- **Order-related communications** are transactional and don't require explicit consent

---

## 16. Hosting and deployment

### 16.1 Hosting

**Hetzner CX22 VPS** (4 GB RAM, 2 vCPU, 40 GB SSD, 20 TB bandwidth) — ~€5.40/mo (~₹490).

Single VPS runs the full stack at launch volume. Sufficient for 5–10× current scale before vertical scaling needed.

### 16.2 Edge / CDN

**Cloudflare** (free tier) in front of everything:

- DNS
- SSL (automatic via Cloudflare or Caddy/Let's Encrypt)
- CDN for static assets
- DDoS protection
- WAF (basic free rules)
- Bot management

### 16.3 Server stack

- **OS:** Ubuntu 24.04 LTS
- **Reverse proxy:** Caddy (automatic HTTPS via Let's Encrypt)
- **Containerization:** Docker + Docker Compose
- **Process manager:** Docker restart policies + systemd for the Docker daemon

### 16.4 Subdomain layout

- `yourbrand.com` → storefront
- `admin.yourbrand.com` → admin
- `api.yourbrand.com` → API

### 16.5 Container layout

```
Caddy (reverse proxy, 443)
    ├─→ storefront (Next.js, internal :3000)
    ├─→ admin (Next.js, internal :3001)
    └─→ api (NestJS, internal :4000)
              │
              ├─→ postgres (internal :5432, not exposed publicly)
              └─→ redis (internal :6379, not exposed publicly)
```

### 16.6 Deployment

- **Source of truth:** Git repository (GitHub)
- **CI:** GitHub Actions runs lint, typecheck, build, tests on every PR
- **CD:** On merge to `main`, GitHub Actions builds Docker images, pushes to registry (GitHub Container Registry — free for private), SSH into VPS, `docker compose pull && docker compose up -d`
- **Rollback:** Previous images tagged with commit SHA; rollback is `docker compose pull <previous-tag> && up`
- **Zero-downtime deploys:** Caddy auto-reloads on container health; Docker rolling restart strategy

### 16.7 Backup posture

Owner has chosen hosting-default backups (Hetzner snapshots — manual, owner-triggered, ~€0.013/GB/month).

Mitigations:

- All code in version control (Git)
- Soft-deletes for user-facing entities
- Audit logs for state changes
- Secrets in env vars on the VPS (not in Git)

Hetzner snapshots can be enabled and scheduled later if posture changes.

### 16.8 Monitoring

- **Sentry** for application errors (storefront, admin, backend)
- **Uptime monitoring** (UptimeRobot free tier or Better Stack)
- **Alerts** to Slack or email on: payment webhook failures, Shiprocket webhook failures, error spikes, uptime breaches

---

## 17. Non-functional requirements

### 17.1 Performance

- **Storefront LCP:** < 2.5s on simulated 4G mobile
- **TBT:** < 200ms
- **CLS:** < 0.1
- **Initial JS bundle:** < 150 KB gzipped
- **Lighthouse CI:** scores ≥ 90 for Performance, Accessibility, SEO on key pages
- **Image strategy:** Next.js `<Image>` with AVIF/WebP, responsive `sizes`, lazy loading, blur placeholders
- **Server rendering:** Server Components + ISR with revalidation on price/stock changes

### 17.2 Accessibility

- **WCAG 2.1 Level AA**
- Semantic HTML, keyboard navigation, visible focus states, ARIA where needed
- Color contrast verified (4.5:1 body, 3:1 large/UI)
- Alt text on every product image
- Form labels associated, error messages announced

### 17.3 SEO

- Per-page dynamic title and meta description
- OpenGraph + Twitter Card meta
- JSON-LD `Product` on PDPs, `Organization` and `WebSite` on home
- `sitemap.xml` auto-generated and revalidated
- `robots.txt`, canonical URLs

### 17.4 Security

- HTTPS everywhere, HSTS enabled
- All inputs validated with Zod at API boundary
- SQL injection: prevented by Prisma's parameterized queries
- XSS: React escapes by default; no `dangerouslySetInnerHTML` on user content
- CSRF: SameSite cookies; double-submit token where needed
- Rate limiting on auth, OTP, promotion application, public APIs (Redis-backed)
- Secrets in env vars, not in Git
- Admin TOTP 2FA mandatory
- Audit log on all admin actions
- Soft-deletes on user-facing entities
- Webhook signature verification on PhonePe, Shiprocket, Meta, BSP
- PII at rest: phone stored canonically for lookups; payment data never stored — tokenized via PhonePe

---

## 18. Open items

| Item | Owner | Resolve before |
|---|---|---|
| Full promotion / coupon specification | Owner | Sprint 7 |
| Serviceable pincode allowlist | Owner | Sprint 3 end |
| HSN codes and GST rates per category | Owner + CA | Sprint 2 start |
| WhatsApp BSP vendor selection | Owner + team | Sprint 12 start |
| DLT template registration (SMS) | Team | Sprint 11 |
| Meta App Review submission | Team | Sprint 13 start |
| WhatsApp template approvals | Team | Sprint 12 / 13 |
| PhonePe PG onboarding + KYC | Owner | Sprint 10 start |
| Lawyer-reviewed Privacy and Return policies | Owner | Within 90 days post-launch |
| POS introduction at store | Owner | Revisit when store volume justifies |

---

## 19. Acknowledged risks

| Risk | Decision | Mitigation |
|---|---|---|
| Overselling from manual stock discipline lapses | Strict manual real-time updates | Fast mobile UI, low-stock alerts, end-of-day reconciliation, audit log |
| Data loss from limited backups | Hetzner snapshots only | Soft-deletes, audit logs, Git for code |
| Conversion loss from prepaid-only | No COD | Revisit at 60–90 days based on abandonment data by pincode |
| Higher abandonment from 7-day return window | Tight window | Monitor returns metrics; extend if needed |
| DPDP non-compliance from template Privacy | Template at launch | Lawyer review within 90 days |
| Meta App Review delay blocks Lead Ads | 1–3 week timeline | Submit during Phase 1 |
| Shiprocket API friction | Single provider at launch | `ShippingProvider` interface for swap-out; reconciliation job |
| PhonePe ecosystem maturity | Primary payment gateway | `PaymentProvider` interface allows Razorpay fallback; +3–5 day buffer in Sprint 10 |
| PhonePe promotional pricing expiry | Lower fees now | Verify contract terms; budget for standard pricing post-promo |
| Single-VPS single point of failure | Hetzner CX22 | Hetzner uptime is strong; monitor and upgrade to HA when scale justifies |

---

## 20. Glossary

- **AOV** — Average Order Value
- **AWB** — Air Waybill (courier-side tracking number)
- **BSP** — WhatsApp Business Solution Provider
- **CAPI** — Meta's Conversions API for server-side tracking
- **DLT** — Distributed Ledger Technology (India's telecom SMS template registration)
- **DPDP** — Digital Personal Data Protection Act, 2023
- **EMQ** — Event Match Quality (Meta's CAPI matching metric)
- **GST** — Goods and Services Tax, India
- **HSN** — Harmonized System of Nomenclature (GST product classification)
- **LCP** — Largest Contentful Paint (Core Web Vital)
- **PDP** — Product Detail Page
- **PG** — Payment Gateway
- **POS** — Point of Sale system
- **RTO** — Return to Origin (undelivered courier package)
- **SKU** — Stock Keeping Unit (unique identifier per variant)
- **UTM** — Urchin Tracking Module (URL params for campaign attribution)
- **VPS** — Virtual Private Server

---

*End of document.*
