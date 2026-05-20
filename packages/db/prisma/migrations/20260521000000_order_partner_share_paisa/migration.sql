-- Sprint 10 (Razorpay Route) — record the partner's share per order.
--
-- Stamped at order creation from the current `partner.split_percent`
-- setting × Order.subtotalPaisa. Frozen on the row so refund + reverse-
-- transfer math is deterministic even if the percent changes later or
-- the partner is swapped out. Defaults to 0 so existing pre-Route orders
-- (and any order placed before the setting is populated) carry a sane
-- value without a backfill.

ALTER TABLE "Order"
  ADD COLUMN "partnerSharePaisa" INTEGER NOT NULL DEFAULT 0;
