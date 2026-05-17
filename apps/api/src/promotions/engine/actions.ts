// Sprint 7 — pure action appliers. Each returns a discount line (or null when
// the action collapses to zero) and mutates EvaluateState in-place so later
// promotions in the stack see the post-discount subtotal.

import { PROMOTION_ACTION_TYPE, type PromotionAction } from '@repo/types';
import type { EvaluateState, EvaluatedDiscountLine, PromotionRule } from './types.js';

interface ApplyContext {
  rule: PromotionRule;
  state: EvaluateState;
}

// Handles order-wide + free-shipping actions. Product-scoped actions need the
// variant→product map and are routed through applyProductScopedAction in
// evaluate.ts.
export function applyAction(action: PromotionAction, ctx: ApplyContext): EvaluatedDiscountLine | null {
  const { rule, state } = ctx;
  switch (action.type) {
    case PROMOTION_ACTION_TYPE.PERCENT_OFF_ORDER: {
      if (state.remainingSubtotalPaisa <= 0) return null;
      const cut = Math.floor((state.remainingSubtotalPaisa * action.percent) / 100);
      if (cut <= 0) return null;
      consumeSubtotal(state, cut);
      return discountLine(rule, cut, `${action.percent}% off your order`);
    }

    case PROMOTION_ACTION_TYPE.FLAT_OFF_ORDER: {
      if (state.remainingSubtotalPaisa <= 0) return null;
      const cut = Math.min(action.amountPaisa, state.remainingSubtotalPaisa);
      if (cut <= 0) return null;
      consumeSubtotal(state, cut);
      return discountLine(rule, cut, formatFlatLabel(cut, 'off your order'));
    }

    case PROMOTION_ACTION_TYPE.FREE_SHIPPING: {
      if (state.freeShipping) return null;
      state.freeShipping = true;
      return discountLine(rule, 0, 'Free shipping');
    }

    case PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS:
    case PROMOTION_ACTION_TYPE.FLAT_OFF_PRODUCTS:
      // Routed through applyProductScopedAction — this branch is a no-op so
      // the type-narrowing exhaustiveness check still passes.
      return null;
  }
}

function consumeSubtotal(state: EvaluateState, amount: number): void {
  state.remainingSubtotalPaisa = Math.max(0, state.remainingSubtotalPaisa - amount);
  // Distribute the cut across lines proportionally — keeps perLineRemaining sane
  // for any later percent_off_products that needs the post-order-discount price.
  const lines = Object.keys(state.perLineRemainingPaisa);
  if (lines.length === 0) return;
  const totalBefore = lines.reduce((s, k) => s + state.perLineRemainingPaisa[k]!, 0);
  if (totalBefore <= 0) return;
  let remaining = amount;
  for (let i = 0; i < lines.length; i++) {
    const k = lines[i]!;
    const before = state.perLineRemainingPaisa[k]!;
    const share = i === lines.length - 1 ? remaining : Math.floor((before * amount) / totalBefore);
    const take = Math.min(share, before);
    state.perLineRemainingPaisa[k] = before - take;
    remaining -= take;
    if (remaining <= 0) break;
  }
}

export function applyProductScopedAction(
  action: { type: typeof PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS; percent: number; productIds: string[] }
    | { type: typeof PROMOTION_ACTION_TYPE.FLAT_OFF_PRODUCTS; amountPaisa: number; productIds: string[] },
  rule: PromotionRule,
  state: EvaluateState,
  productIdByVariant: Record<string, string>,
): EvaluatedDiscountLine | null {
  const targets = new Set(action.productIds);
  // Pick variantIds whose product is in the action's target list.
  const matchedVariants = Object.keys(state.perLineRemainingPaisa).filter((v) =>
    targets.has(productIdByVariant[v]!),
  );
  if (matchedVariants.length === 0) return null;

  if (action.type === PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS) {
    let cut = 0;
    for (const v of matchedVariants) {
      const before = state.perLineRemainingPaisa[v]!;
      if (before <= 0) continue;
      const piece = Math.floor((before * action.percent) / 100);
      if (piece <= 0) continue;
      state.perLineRemainingPaisa[v] = before - piece;
      cut += piece;
    }
    if (cut <= 0) return null;
    state.remainingSubtotalPaisa = Math.max(0, state.remainingSubtotalPaisa - cut);
    return discountLine(rule, cut, `${action.percent}% off selected items`);
  }

  // flat_off_products — split the flat amount proportionally across matched lines,
  // capped at the per-line remaining.
  const totalMatchedPaisa = matchedVariants.reduce((s, v) => s + state.perLineRemainingPaisa[v]!, 0);
  if (totalMatchedPaisa <= 0) return null;
  const overallCut = Math.min(action.amountPaisa, totalMatchedPaisa);
  let cut = 0;
  let remaining = overallCut;
  for (let i = 0; i < matchedVariants.length; i++) {
    const v = matchedVariants[i]!;
    const before = state.perLineRemainingPaisa[v]!;
    if (before <= 0) continue;
    const share = i === matchedVariants.length - 1
      ? remaining
      : Math.floor((before * overallCut) / totalMatchedPaisa);
    const take = Math.min(share, before);
    state.perLineRemainingPaisa[v] = before - take;
    cut += take;
    remaining -= take;
    if (remaining <= 0) break;
  }
  if (cut <= 0) return null;
  state.remainingSubtotalPaisa = Math.max(0, state.remainingSubtotalPaisa - cut);
  return discountLine(rule, cut, formatFlatLabel(cut, 'off selected items'));
}

function discountLine(rule: PromotionRule, amountPaisa: number, description: string): EvaluatedDiscountLine {
  return {
    promotionId: rule.id,
    promotionName: rule.name,
    source: rule.redeemedCouponCode ? 'coupon' : 'automatic',
    couponCode: rule.redeemedCouponCode,
    amountPaisa,
    description,
  };
}

function formatFlatLabel(paisa: number, suffix: string): string {
  const rupees = Math.floor(paisa / 100);
  return `₹${rupees} ${suffix}`;
}
