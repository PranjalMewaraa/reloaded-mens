-- Sprint 6 — returns + exchanges. Two new tables (ReturnRequest + ReturnLineItem)
-- with their relations to Order, OrderItem, ProductVariant, and RefundRequest.
-- Applied via db push during dev; this file captures the equivalent SQL for clean
-- installs.

CREATE TABLE "ReturnRequest" (
  "id"                TEXT NOT NULL,
  "returnNumber"      TEXT NOT NULL,
  "orderId"           TEXT NOT NULL,
  "state"             TEXT NOT NULL DEFAULT 'requested',
  "method"            TEXT NOT NULL,
  "customerNote"      TEXT,
  "internalNote"      TEXT,
  "rejectedReason"    TEXT,
  "refundRequestId"   TEXT,
  "approvedAt"        TIMESTAMP(3),
  "rejectedAt"        TIMESTAMP(3),
  "pickupScheduledAt" TIMESTAMP(3),
  "receivedAt"        TIMESTAMP(3),
  "verifiedAt"        TIMESTAMP(3),
  "completedAt"       TIMESTAMP(3),
  "cancelledAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReturnRequest_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnRequest_state_idx" ON "ReturnRequest"("state");
CREATE INDEX "ReturnRequest_createdAt_idx" ON "ReturnRequest"("createdAt");

CREATE TABLE "ReturnLineItem" (
  "id"                    TEXT NOT NULL,
  "returnRequestId"       TEXT NOT NULL,
  "orderItemId"           TEXT NOT NULL,
  "variantId"             TEXT NOT NULL,
  "productName"           TEXT NOT NULL,
  "variantLabel"          TEXT,
  "sku"                   TEXT NOT NULL,
  "unitPricePaisa"        INTEGER NOT NULL,
  "quantity"              INTEGER NOT NULL,
  "reason"                TEXT NOT NULL,
  "reasonNote"            TEXT,
  "action"                TEXT NOT NULL,
  "exchangeVariantId"     TEXT,
  "exchangeVariantLabel"  TEXT,
  "verifiedCondition"     TEXT,
  "restockDecision"       TEXT NOT NULL DEFAULT 'pending',
  "photoUrls"             TEXT[] NOT NULL DEFAULT '{}',
  "exchangeReservedUntil" TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnLineItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnLineItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReturnLineItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReturnLineItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReturnLineItem_exchangeVariantId_fkey" FOREIGN KEY ("exchangeVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ReturnLineItem_returnRequestId_idx" ON "ReturnLineItem"("returnRequestId");
CREATE INDEX "ReturnLineItem_variantId_idx" ON "ReturnLineItem"("variantId");
CREATE INDEX "ReturnLineItem_exchangeVariantId_idx" ON "ReturnLineItem"("exchangeVariantId");
