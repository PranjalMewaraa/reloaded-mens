-- Sprint 8 — customer auth, leads, reviews.
-- Adds Customer.sessionVersion; creates CustomerOtp, Lead, Review; back-relations.
-- Schema applied via `prisma db push --accept-data-loss`; this file is recorded via
-- `prisma migrate resolve --applied` so source control matches migration history.

-- ---------------- Customer additions ----------------

ALTER TABLE "Customer" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- ---------------- CustomerOtp ----------------

CREATE TABLE "CustomerOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "deliveredTo" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerOtp_phone_createdAt_idx" ON "CustomerOtp"("phone", "createdAt");
CREATE INDEX "CustomerOtp_expiresAt_idx" ON "CustomerOtp"("expiresAt");

-- ---------------- Lead ----------------

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT,
    "metaFormId" TEXT,
    "metaLeadId" TEXT,
    "customFields" JSONB,
    "assignedToId" TEXT,
    "internalNote" TEXT,
    "contactedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lead_metaLeadId_key" ON "Lead"("metaLeadId");
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");
CREATE INDEX "Lead_source_idx" ON "Lead"("source");
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

ALTER TABLE "Lead"
    ADD CONSTRAINT "Lead_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------- Review ----------------

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectedReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

ALTER TABLE "Review"
    ADD CONSTRAINT "Review_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
    ADD CONSTRAINT "Review_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review"
    ADD CONSTRAINT "Review_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
