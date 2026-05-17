// Sprint 7 — internal types shared across the promotion engine. These are not
// part of the public Zod schemas; the engine consumes already-loaded variant
// metadata + promotion rows from the DB.

import type { PromotionAction, PromotionCondition } from '@repo/types';

// One cart line, enriched with product/category metadata the conditions/actions
// need to evaluate. Cart-evaluate loads these upfront so condition checks are
// pure object reads, no DB calls per-condition.
export interface CartLineCtx {
  variantId: string;
  productId: string;
  categoryIds: string[];
  quantity: number;
  unitPricePaisa: number;
  lineSubtotalPaisa: number;
}

export interface EvaluateInput {
  lines: CartLineCtx[];
  pincode?: string;
  phone?: string;
}

export interface EvaluateCtx {
  // True when no order has been placed yet for the given phone. Cart-evaluate
  // can leave this as null when the customer hasn't entered their phone — the
  // `customer_first_time` condition then treats it as "unknown" and fails open
  // for visibility (we re-check at order-create where phone is guaranteed).
  isFirstTimeCustomer: boolean | null;
}

// Engine-level representation of a promotion. Conditions/actions are already
// parsed (the DB roundtrip ran them through promotionConditionSchema /
// promotionActionSchema).
export interface PromotionRule {
  id: string;
  name: string;
  isAutomatic: boolean;
  stackable: boolean;
  stackPriority: number;
  conditions: PromotionCondition[];
  actions: PromotionAction[];
  // Set when this rule was selected because a coupon redirected to it. Null
  // for automatic promotions.
  redeemedCouponCode: string | null;
}

export interface EvaluatedDiscountLine {
  promotionId: string;
  promotionName: string;
  source: 'automatic' | 'coupon';
  couponCode: string | null;
  amountPaisa: number;
  description: string;
}

export interface EvaluateState {
  // Running subtotal as actions apply. Clamped at zero — flat discounts can't
  // drive the total negative.
  remainingSubtotalPaisa: number;
  // Per-line remaining (after percent_off_products / flat_off_products eat into it).
  // Keyed by variantId.
  perLineRemainingPaisa: Record<string, number>;
  freeShipping: boolean;
}
