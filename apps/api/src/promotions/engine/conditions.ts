// Sprint 7 — pure condition evaluators. Each branch of promotionConditionSchema
// has a matching case here. Keep these functions pure (no DB, no clock) so unit
// tests can hit them directly.

import { PROMOTION_CONDITION_TYPE, type PromotionCondition } from '@repo/types';
import type { EvaluateCtx, EvaluateInput } from './types.js';

export function conditionMatches(
  cond: PromotionCondition,
  input: EvaluateInput,
  ctx: EvaluateCtx,
): boolean {
  switch (cond.type) {
    case PROMOTION_CONDITION_TYPE.CART_SUBTOTAL_MIN:
      return cartSubtotal(input) >= cond.amountPaisa;

    case PROMOTION_CONDITION_TYPE.CART_CONTAINS_PRODUCT: {
      const target = new Set(cond.productIds);
      return input.lines.some((l) => target.has(l.productId));
    }

    case PROMOTION_CONDITION_TYPE.CART_CONTAINS_CATEGORY: {
      const target = new Set(cond.categoryIds);
      return input.lines.some((l) => l.categoryIds.some((c) => target.has(c)));
    }

    case PROMOTION_CONDITION_TYPE.CUSTOMER_FIRST_TIME:
      // Unknown (phone not entered yet) — fail open at the cart, fail closed at
      // order-create. See EvaluateCtx.isFirstTimeCustomer doc comment.
      return ctx.isFirstTimeCustomer !== false;

    case PROMOTION_CONDITION_TYPE.PINCODE_IN:
      if (!input.pincode) return false;
      return cond.pincodes.includes(input.pincode);
  }
}

function cartSubtotal(input: EvaluateInput): number {
  return input.lines.reduce((s, l) => s + l.lineSubtotalPaisa, 0);
}
