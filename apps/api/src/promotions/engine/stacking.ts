// Sprint 7 — pick the final ordered list of promotions to apply.
//
// Rules:
//   1. Coupon-gated promotion wins its slot. When the coupon's promotion is
//      stackable=false, it applies alone (no automatic promotions stack on top).
//   2. When the coupon's promotion is stackable=true OR there's no coupon, we
//      sort automatic promotions by stackPriority ascending and apply them in
//      order. The first non-stackable automatic terminates the stack.
//   3. Two stackable=false promotions never apply together.

import type { PromotionRule } from './types.js';

export function selectStack(
  matchingAutomatic: PromotionRule[],
  couponPromotion: PromotionRule | null,
): PromotionRule[] {
  if (couponPromotion && !couponPromotion.stackable) {
    return [couponPromotion];
  }

  const sorted = [...matchingAutomatic].sort((a, b) => a.stackPriority - b.stackPriority);
  const out: PromotionRule[] = [];
  if (couponPromotion) out.push(couponPromotion);

  for (const promo of sorted) {
    if (!promo.stackable) {
      // Non-stackable automatic: only apply if nothing else is in the stack.
      if (out.length === 0) {
        out.push(promo);
        break;
      }
      // Skip — stackable coupon already took the slot.
      continue;
    }
    out.push(promo);
  }
  return out;
}
