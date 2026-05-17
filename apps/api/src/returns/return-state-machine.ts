import { RETURN_METHOD, RETURN_STATE, type ReturnState } from '@repo/types';

// Pure helpers. Mirrors orders/order-state-machine.ts. Server enforces; admin UI
// uses the same table to decide which buttons to show.

const TRANSITIONS_FROM_REQUESTED: ReturnState[] = [
  RETURN_STATE.APPROVED,
  RETURN_STATE.REJECTED,
  RETURN_STATE.CANCELLED,
];

const TRANSITIONS_FROM_APPROVED: ReturnState[] = [
  RETURN_STATE.PICKUP_SCHEDULED,
  RETURN_STATE.STORE_DROPOFF_PENDING,
  RETURN_STATE.CANCELLED,
];

const TRANSITIONS_FROM_PICKUP_SCHEDULED: ReturnState[] = [
  RETURN_STATE.IN_TRANSIT,
  RETURN_STATE.CANCELLED,
];

const TRANSITIONS_FROM_STORE_DROPOFF_PENDING: ReturnState[] = [
  RETURN_STATE.RECEIVED,
  RETURN_STATE.CANCELLED,
];

const TRANSITIONS_FROM_IN_TRANSIT: ReturnState[] = [
  RETURN_STATE.RECEIVED,
  RETURN_STATE.CANCELLED,
];

const TRANSITIONS_FROM_RECEIVED: ReturnState[] = [
  RETURN_STATE.VERIFIED,
  RETURN_STATE.CANCELLED,
];

const TRANSITIONS_FROM_VERIFIED: ReturnState[] = [RETURN_STATE.COMPLETED];

const NEXT: Record<string, ReturnState[]> = {
  [RETURN_STATE.REQUESTED]: TRANSITIONS_FROM_REQUESTED,
  [RETURN_STATE.APPROVED]: TRANSITIONS_FROM_APPROVED,
  [RETURN_STATE.PICKUP_SCHEDULED]: TRANSITIONS_FROM_PICKUP_SCHEDULED,
  [RETURN_STATE.STORE_DROPOFF_PENDING]: TRANSITIONS_FROM_STORE_DROPOFF_PENDING,
  [RETURN_STATE.IN_TRANSIT]: TRANSITIONS_FROM_IN_TRANSIT,
  [RETURN_STATE.RECEIVED]: TRANSITIONS_FROM_RECEIVED,
  [RETURN_STATE.VERIFIED]: TRANSITIONS_FROM_VERIFIED,
  [RETURN_STATE.COMPLETED]: [],
  [RETURN_STATE.REJECTED]: [],
  [RETURN_STATE.CANCELLED]: [],
};

export function nextAllowedStates(current: ReturnState): ReturnState[] {
  return NEXT[current] ?? [];
}

export function canTransition(from: ReturnState, to: ReturnState): boolean {
  return nextAllowedStates(from).includes(to);
}

// Customer self-cancel is allowed while the return hasn't been received yet. Once
// admin marks it received, only admin can move it forward.
const CUSTOMER_CANCEL_ALLOWED: readonly string[] = [
  RETURN_STATE.REQUESTED,
  RETURN_STATE.APPROVED,
  RETURN_STATE.PICKUP_SCHEDULED,
  RETURN_STATE.STORE_DROPOFF_PENDING,
];

export function canCustomerCancel(state: ReturnState): boolean {
  return CUSTOMER_CANCEL_ALLOWED.includes(state);
}

const CANCEL_TERMINAL: readonly string[] = [
  RETURN_STATE.COMPLETED,
  RETURN_STATE.REJECTED,
  RETURN_STATE.CANCELLED,
];
export function isTerminal(state: ReturnState): boolean {
  return CANCEL_TERMINAL.includes(state);
}

// Whether stock should be released back to saleable inventory on this transition.
// Returns true on reject + cancel; verification handles per-line restock decisions
// individually (not via this helper).
export function shouldReleaseExchangeReservation(state: ReturnState): boolean {
  return state === RETURN_STATE.REJECTED || state === RETURN_STATE.CANCELLED;
}

// Resolve the timestamp column to stamp on ReturnRequest for a given state.
export function transitionTimestampField(target: ReturnState):
  | 'approvedAt'
  | 'rejectedAt'
  | 'pickupScheduledAt'
  | 'receivedAt'
  | 'verifiedAt'
  | 'completedAt'
  | 'cancelledAt'
  | null {
  switch (target) {
    case RETURN_STATE.APPROVED:
      return 'approvedAt';
    case RETURN_STATE.REJECTED:
      return 'rejectedAt';
    case RETURN_STATE.PICKUP_SCHEDULED:
      return 'pickupScheduledAt';
    case RETURN_STATE.RECEIVED:
      return 'receivedAt';
    case RETURN_STATE.VERIFIED:
      return 'verifiedAt';
    case RETURN_STATE.COMPLETED:
      return 'completedAt';
    case RETURN_STATE.CANCELLED:
      return 'cancelledAt';
    default:
      return null;
  }
}

// Decide which post-approval state to drop into based on the chosen method.
// Courier pickup → pickup_scheduled when a date is set; store dropoff →
// store_dropoff_pending immediately.
export function postApprovalState(
  method: string,
  hasPickupSchedule: boolean,
): ReturnState {
  if (method === RETURN_METHOD.STORE_DROPOFF) return RETURN_STATE.STORE_DROPOFF_PENDING;
  return hasPickupSchedule ? RETURN_STATE.PICKUP_SCHEDULED : RETURN_STATE.APPROVED;
}
