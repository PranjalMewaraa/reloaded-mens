-- Sprint 7 — Promotions + coupon rebuild + CouponUsage.
-- This migration drops the Sprint 4 Coupon table (which was a discount-math table
-- conflated with the redeemable code) and recreates a clean two-table model:
--   Promotion   — the rule (conditions + actions + automatic vs coupon-gated)
--   Coupon      — a redeemable code pointing to a Promotion
--   CouponUsage — append-only ledger of redemptions per (coupon, customer/phone, order)
-- The dev workflow applied the schema via `prisma db push --accept-data-loss`. This
-- file is recorded via `prisma migrate resolve --applied` so source control matches
-- the migration history without dropping prod data.

-- ---------------- Drop Sprint 4 Coupon ----------------

DROP TABLE IF EXISTS "Coupon";

-- ---------------- Promotion ----------------

CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "stackPriority" INTEGER NOT NULL DEFAULT 100,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Promotion_isActive_isAutomatic_idx" ON "Promotion"("isActive", "isAutomatic");
CREATE INDEX "Promotion_validFrom_validTo_idx" ON "Promotion"("validFrom", "validTo");

-- ---------------- Coupon (rebuilt) ----------------

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "usageLimitTotal" INTEGER NOT NULL DEFAULT 0,
    "usageLimitPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "batchLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_promotionId_idx" ON "Coupon"("promotionId");
CREATE INDEX "Coupon_batchLabel_idx" ON "Coupon"("batchLabel");

ALTER TABLE "Coupon"
    ADD CONSTRAINT "Coupon_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------- CouponUsage ----------------

CREATE TABLE "CouponUsage" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT,
    "phone" TEXT,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponUsage_orderId_key" ON "CouponUsage"("orderId");
CREATE INDEX "CouponUsage_couponId_customerId_idx" ON "CouponUsage"("couponId", "customerId");
CREATE INDEX "CouponUsage_couponId_phone_idx" ON "CouponUsage"("couponId", "phone");

ALTER TABLE "CouponUsage"
    ADD CONSTRAINT "CouponUsage_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponUsage"
    ADD CONSTRAINT "CouponUsage_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------- Order: appliedPromotionIds ----------------

ALTER TABLE "Order"
    ADD COLUMN "appliedPromotionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
