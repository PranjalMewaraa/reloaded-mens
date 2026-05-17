import { ORDER_STATE, type OrderState } from '@repo/types';

// Pure functions. No DB. Drives both server-side enforcement (transition + cancel
// endpoints) and client-side button visibility (admin order detail) so the two never
// drift.

// Maps each state to the states it can transition INTO. Cancellation is permitted
// from any non-terminal state but is invoked via a dedicated /cancel endpoint, so
// it's omitted from this table (the table only covers forward progression).
const NEXT: Record<string, OrderState[]> = {
  [ORDER_STATE.PAYMENT_PENDING]: [ORDER_STATE.CONFIRMED, ORDER_STATE.PAYMENT_FAILED],
  [ORDER_STATE.CONFIRMED]: [ORDER_STATE.PACKED],
  [ORDER_STATE.PACKED]: [ORDER_STATE.SHIPPED],
  [ORDER_STATE.SHIPPED]: [ORDER_STATE.OUT_FOR_DELIVERY, ORDER_STATE.DELIVERED],
  [ORDER_STATE.OUT_FOR_DELIVERY]: [ORDER_STATE.DELIVERED],
  // Sprint 6 will add the return path off DELIVERED.
  [ORDER_STATE.DELIVERED]: [],
  [ORDER_STATE.PAYMENT_FAILED]: [],
  [ORDER_STATE.CANCELLED]: [],
  [ORDER_STATE.RETURN_REQUESTED]: [],
  [ORDER_STATE.RETURNED]: [],
  [ORDER_STATE.REFUNDED]: [],
};

export function nextAllowedStates(current: OrderState): OrderState[] {
  return NEXT[current] ?? [];
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  return nextAllowedStates(from).includes(to);
}

// Customer self-cancel is allowed up to (and including) `confirmed`. Once a parcel is
// `packed`, only admin can cancel — operationally too late for self-service.
export function canCustomerCancel(state: OrderState): boolean {
  return state === ORDER_STATE.PAYMENT_PENDING || state === ORDER_STATE.CONFIRMED;
}

// Admin cancel is allowed anywhere up to (but not including) DELIVERED. Cancelling a
// delivered order is a return, not a cancel — that's Sprint 6's flow.
const ADMIN_CANCEL_BLOCKED: readonly string[] = [
  ORDER_STATE.DELIVERED,
  ORDER_STATE.CANCELLED,
  ORDER_STATE.REFUNDED,
  ORDER_STATE.RETURNED,
];
export function canAdminCancel(state: OrderState): boolean {
  return !ADMIN_CANCEL_BLOCKED.includes(state);
}

// Staff cancel mirrors customer cancel — only allowed up to packed. Admin gets the
// broader window via canAdminCancel().
const STAFF_CANCEL_ALLOWED: readonly string[] = [
  ORDER_STATE.PAYMENT_PENDING,
  ORDER_STATE.CONFIRMED,
  ORDER_STATE.PACKED,
];
export function canStaffCancel(state: OrderState): boolean {
  return STAFF_CANCEL_ALLOWED.includes(state);
}

// Maps a transition target to the timestamp column we should stamp on the Order row.
// Returning null means no timestamp column for this state (e.g. payment_failed has
// no dedicated time field — failedAt lives on Payment).
export function transitionTimestampField(
  target: OrderState,
):
  | 'confirmedAt'
  | 'packedAt'
  | 'shippedAt'
  | 'outForDeliveryAt'
  | 'deliveredAt'
  | 'cancelledAt'
  | null {
  switch (target) {
    case ORDER_STATE.CONFIRMED:
      return 'confirmedAt';
    case ORDER_STATE.PACKED:
      return 'packedAt';
    case ORDER_STATE.SHIPPED:
      return 'shippedAt';
    case ORDER_STATE.OUT_FOR_DELIVERY:
      return 'outForDeliveryAt';
    case ORDER_STATE.DELIVERED:
      return 'deliveredAt';
    case ORDER_STATE.CANCELLED:
      return 'cancelledAt';
    default:
      return null;
  }
}

// Whether stock should re-increment when this order is cancelled. Admin override is the
// caller's responsibility — this just answers "is restocking the default for this state?".
// Sprint 5: always true for now. Sprint 11 will refine: post-shipped cancels won't restock
// until the parcel physically returns.
export function shouldRestockOnCancel(_state: OrderState): boolean {
  return true;
}
