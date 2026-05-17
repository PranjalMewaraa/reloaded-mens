-- Sprint 5 — order lifecycle: extends Order with timestamps + tracking, adds
-- OrderEvent (timeline) + RefundRequest (refund workflow). Applied via db push
-- during dev; this file captures the equivalent SQL for clean installs.

ALTER TABLE "Order"
  ADD COLUMN     "internalNote" TEXT,
  ADD COLUMN     "packedAt" TIMESTAMP(3),
  ADD COLUMN     "shippedAt" TIMESTAMP(3),
  ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3),
  ADD COLUMN     "deliveredAt" TIMESTAMP(3),
  ADD COLUMN     "cancelledAt" TIMESTAMP(3),
  ADD COLUMN     "cancelReason" TEXT,
  ADD COLUMN     "trackingNumber" TEXT,
  ADD COLUMN     "trackingToken" TEXT;

CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");
CREATE INDEX "Order_trackingNumber_idx" ON "Order"("trackingNumber");

CREATE TABLE "OrderEvent" (
  "id"        TEXT NOT NULL,
  "orderId"   TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "message"   TEXT,
  "actor"     TEXT NOT NULL,
  "actorId"   TEXT,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");
CREATE INDEX "OrderEvent_eventType_idx" ON "OrderEvent"("eventType");

CREATE TABLE "RefundRequest" (
  "id"             TEXT NOT NULL,
  "refundNumber"   TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending_admin_approval',
  "amountPaisa"    INTEGER NOT NULL,
  "reason"         TEXT NOT NULL,
  "requestedBy"    TEXT NOT NULL,
  "approvedBy"     TEXT,
  "rejectedReason" TEXT,
  "provider"       TEXT,
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RefundRequest_refundNumber_key" ON "RefundRequest"("refundNumber");
CREATE INDEX "RefundRequest_orderId_idx" ON "RefundRequest"("orderId");
CREATE INDEX "RefundRequest_status_idx" ON "RefundRequest"("status");
