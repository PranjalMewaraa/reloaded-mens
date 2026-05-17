// Sprint 7 — top-level cart evaluator. Pure function — caller (cart-evaluate
// controller + order create) is responsible for loading variants, promotions,
// coupons, etc. The engine consumes already-validated PromotionRule[] and
// returns the final discount stack.

import { PROMOTION_ACTION_TYPE } from '@repo/types';
import { applyAction, applyProductScopedAction } from './actions.js';
import { conditionMatches } from './conditions.js';
import { selectStack } from './stacking.js';
import type {
  EvaluateCtx,
  EvaluateInput,
  EvaluateState,
  EvaluatedDiscountLine,
  PromotionRule,
} from './types.js';

export interface EvaluateResult {
  subtotalPaisa: number;
  totalDiscountPaisa: number;
  discountLines: EvaluatedDiscountLine[];
  freeShipping: boolean;
  appliedPromotionIds: string[];
}

export function evaluateCart(
  input: EvaluateInput,
  ctx: EvaluateCtx,
  candidates: { automatic: PromotionRule[]; coupon: PromotionRule | null },
): EvaluateResult {
  const subtotalPaisa = input.lines.reduce((s, l) => s + l.lineSubtotalPaisa, 0);

  const automaticMatching = candidates.automatic.filter((p) =>
    p.conditions.every((c) => conditionMatches(c, input, ctx)),
  );
  const couponMatching =
    candidates.coupon && candidates.coupon.conditions.every((c) => conditionMatches(c, input, ctx))
      ? candidates.coupon
      : null;

  const stack = selectStack(automaticMatching, couponMatching);

  const state: EvaluateState = {
    remainingSubtotalPaisa: subtotalPaisa,
    perLineRemainingPaisa: Object.fromEntries(input.lines.map((l) => [l.variantId, l.lineSubtotalPaisa])),
    freeShipping: false,
  };
  const productIdByVariant = Object.fromEntries(input.lines.map((l) => [l.variantId, l.productId]));

  const discountLines: EvaluatedDiscountLine[] = [];
  const appliedPromotionIds: string[] = [];

  for (const rule of stack) {
    let ruleProducedDiscount = false;
    for (const action of rule.actions) {
      let line: EvaluatedDiscountLine | null;
      if (
        action.type === PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS ||
        action.type === PROMOTION_ACTION_TYPE.FLAT_OFF_PRODUCTS
      ) {
        line = applyProductScopedAction(action, rule, state, productIdByVariant);
      } else {
        line = applyAction(action, { rule, state });
      }
      if (line) {
        discountLines.push(line);
        ruleProducedDiscount = true;
      }
    }
    if (ruleProducedDiscount) appliedPromotionIds.push(rule.id);
  }

  const totalDiscountPaisa = discountLines.reduce((s, l) => s + l.amountPaisa, 0);
  return {
    subtotalPaisa,
    totalDiscountPaisa,
    discountLines,
    freeShipping: state.freeShipping,
    appliedPromotionIds,
  };
}
