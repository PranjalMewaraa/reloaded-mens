// Enums and constants used across the codebase.
// Mirror these in Prisma schema where they appear in the DB.

export const ADMIN_ROLE = {
  ADMIN: 'admin',
  STAFF: 'staff',
} as const;
export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

export const ORDER_STATE = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURN_REQUESTED: 'return_requested',
  RETURNED: 'returned',
  REFUNDED: 'refunded',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_FAILED: 'payment_failed',
} as const;
export type OrderState = (typeof ORDER_STATE)[keyof typeof ORDER_STATE];

export const PAYMENT_STATE = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;
export type PaymentState = (typeof PAYMENT_STATE)[keyof typeof PAYMENT_STATE];

export const AVAILABILITY = {
  ONLINE_SHIPPABLE: 'online_shippable',
  IN_STORE_ONLY: 'in_store_only',
  BOTH: 'both',
} as const;
export type Availability = (typeof AVAILABILITY)[keyof typeof AVAILABILITY];

export const RETURN_STATE = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  PICKUP_SCHEDULED: 'pickup_scheduled',
  STORE_DROPOFF_PENDING: 'store_dropoff_pending',
  IN_TRANSIT: 'in_transit',
  RECEIVED: 'received',
  VERIFIED: 'verified',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;
export type ReturnState = (typeof RETURN_STATE)[keyof typeof RETURN_STATE];

export const RETURN_TYPE = {
  RETURN: 'return',
  EXCHANGE: 'exchange',
  REPLACEMENT: 'replacement',
} as const;
export type ReturnType = (typeof RETURN_TYPE)[keyof typeof RETURN_TYPE];

export const RETURN_REASON = {
  SIZE_ISSUE: 'size_issue',
  QUALITY: 'quality',
  NOT_AS_EXPECTED: 'not_as_expected',
  DAMAGED: 'damaged',
  OTHER: 'other',
} as const;
export type ReturnReason = (typeof RETURN_REASON)[keyof typeof RETURN_REASON];

export const LEAD_SOURCE = {
  META_LEAD_ADS: 'meta_lead_ads',
  WHATSAPP: 'whatsapp',
  WEBSITE_SIGNUP: 'website_signup',
  MANUAL: 'manual',
} as const;
export type LeadSource = (typeof LEAD_SOURCE)[keyof typeof LEAD_SOURCE];

export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  LOST: 'lost',
} as const;
export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const ADDRESS_TYPE = {
  BILLING: 'billing',
  SHIPPING: 'shipping',
  BOTH: 'both',
} as const;
export type AddressType = (typeof ADDRESS_TYPE)[keyof typeof ADDRESS_TYPE];

export const INVENTORY_CHANGE_TYPE = {
  STORE_SALE: 'store_sale',
  ONLINE_ORDER: 'online_order',
  RESTOCK: 'restock',
  RETURN_RESTOCK: 'return_restock',
  CORRECTION: 'correction',
  WRITE_OFF: 'write_off',
} as const;
export type InventoryChangeType =
  (typeof INVENTORY_CHANGE_TYPE)[keyof typeof INVENTORY_CHANGE_TYPE];

export const ACTOR = {
  SYSTEM: 'system',
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin',
} as const;
export type Actor = (typeof ACTOR)[keyof typeof ACTOR];

// Audit event types used by the auth + audit modules.
// More are added per sprint as new admin actions ship.
export const AUDIT_EVENT_TYPE = {
  ADMIN_LOGIN_ATTEMPT: 'admin.login.attempt',
  ADMIN_LOGIN_SUCCESS: 'admin.login.success',
  ADMIN_LOGIN_FAILURE: 'admin.login.failure',
  ADMIN_TOTP_ENROLLED: 'admin.totp.enrolled',
  ADMIN_TOTP_SUCCESS: 'admin.totp.success',
  ADMIN_TOTP_FAILURE: 'admin.totp.failure',
  ADMIN_LOGOUT: 'admin.logout',
  ADMIN_TOKEN_REFRESHED: 'admin.token.refreshed',
  // Sprint 5 — order lifecycle admin actions. Refund approval is admin-only, so the
  // audit log gives ops + finance a single timestamped trail to reconcile against.
  ORDER_STATE_CHANGED: 'order.state.changed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_NOTE_UPDATED: 'order.note.updated',
  ORDER_REFUND_REQUESTED: 'order.refund.requested',
  ORDER_REFUND_APPROVED: 'order.refund.approved',
  ORDER_REFUND_REJECTED: 'order.refund.rejected',
  // Sprint 6 — return workflow.
  ORDER_RETURN_REQUESTED: 'order.return.requested',
  ORDER_RETURN_APPROVED: 'order.return.approved',
  ORDER_RETURN_REJECTED: 'order.return.rejected',
  ORDER_RETURN_RECEIVED: 'order.return.received',
  ORDER_RETURN_VERIFIED: 'order.return.verified',
  ORDER_RETURN_COMPLETED: 'order.return.completed',
  ORDER_RETURN_CANCELLED: 'order.return.cancelled',
  // Sprint 7 — promotions engine.
  PROMOTION_CREATED: 'promotion.created',
  PROMOTION_UPDATED: 'promotion.updated',
  PROMOTION_DELETED: 'promotion.deleted',
  COUPONS_BULK_GENERATED: 'coupons.bulk_generated',
  COUPON_CREATED: 'coupon.created',
  COUPON_DEACTIVATED: 'coupon.deactivated',
} as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPE)[keyof typeof AUDIT_EVENT_TYPE];

// Stage values returned by /auth/login indicating what the client should do next.
// 'complete' is returned when TOTP is disabled via ADMIN_TOTP_REQUIRED=false and the
// session has been issued directly from the login call.
export const AUTH_STAGE = {
  TOTP_REQUIRED: 'totp_required',
  TOTP_ENROLLMENT_REQUIRED: 'totp_enrollment_required',
  COMPLETE: 'complete',
} as const;
export type AuthStage = (typeof AUTH_STAGE)[keyof typeof AUTH_STAGE];

// Sprint 4 — picks which provider implementation handles createSession + verifyWebhook.
// 'mock' auto-succeeds in dev; 'phonepe' is the Sprint 10 real integration (stub today).
export const PAYMENT_PROVIDER = {
  MOCK: 'mock',
  PHONEPE: 'phonepe',
} as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

// Sprint 5 — order timeline events. Persisted as strings on OrderEvent.eventType.
// State-transition events (state.*) line up 1:1 with ORDER_STATE values; side
// channels (payment.*, note.*, tracking.*, refund.*) keep the timeline informative
// without inventing dummy states.
export const ORDER_EVENT_TYPE = {
  STATE_CONFIRMED: 'state.confirmed',
  STATE_PACKED: 'state.packed',
  STATE_SHIPPED: 'state.shipped',
  STATE_OUT_FOR_DELIVERY: 'state.out_for_delivery',
  STATE_DELIVERED: 'state.delivered',
  STATE_CANCELLED: 'state.cancelled',
  STATE_REFUNDED: 'state.refunded',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  NOTE_UPDATED: 'note.updated',
  TRACKING_ASSIGNED: 'tracking.assigned',
  REFUND_REQUESTED: 'refund.requested',
  REFUND_REJECTED: 'refund.rejected',
  // Sprint 6 — return lifecycle. Payload always carries `{ returnNumber }` so the
  // admin order detail can filter the timeline per return.
  RETURN_REQUESTED: 'return.requested',
  RETURN_APPROVED: 'return.approved',
  RETURN_REJECTED: 'return.rejected',
  RETURN_PICKUP_SCHEDULED: 'return.pickup_scheduled',
  RETURN_RECEIVED: 'return.received',
  RETURN_VERIFIED: 'return.verified',
  RETURN_COMPLETED: 'return.completed',
  RETURN_CANCELLED: 'return.cancelled',
} as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPE)[keyof typeof ORDER_EVENT_TYPE];

// Sprint 6 — return-flow extensions used by ReturnLineItem + verify dialog.
export const RESTOCK_DECISION = {
  RESTOCK: 'restock',
  DAMAGE_WRITEOFF: 'damage_writeoff',
  PENDING: 'pending',
} as const;
export type RestockDecision = (typeof RESTOCK_DECISION)[keyof typeof RESTOCK_DECISION];

export const VERIFIED_CONDITION = {
  AS_NEW: 'as_new',
  USED: 'used',
  DAMAGED: 'damaged',
} as const;
export type VerifiedCondition = (typeof VERIFIED_CONDITION)[keyof typeof VERIFIED_CONDITION];

export const RETURN_METHOD = {
  COURIER_PICKUP: 'courier_pickup',
  STORE_DROPOFF: 'store_dropoff',
} as const;
export type ReturnMethod = (typeof RETURN_METHOD)[keyof typeof RETURN_METHOD];

// Sprint 5 — refund workflow status. 'pending_admin_approval' is the queue state
// staff drop into when filing the request; 'approved' triggers the (mock) refund.
export const REFUND_STATUS = {
  PENDING_ADMIN_APPROVAL: 'pending_admin_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
} as const;
export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

// Sprint 5 — shipping provider driver. 'mock' returns a fake AWB; 'shiprocket'
// lands in Sprint 11.
export const SHIPPING_PROVIDER = {
  MOCK: 'mock',
  SHIPROCKET: 'shiprocket',
} as const;
export type ShippingProvider = (typeof SHIPPING_PROVIDER)[keyof typeof SHIPPING_PROVIDER];

// =====================================================
// Sprint 7 — Promotions engine
// =====================================================

// Conditions that gate when a promotion is applicable. Stored as JSON on
// Promotion.conditions with discriminated-union shape; admin UI surfaces one
// editor per type.
export const PROMOTION_CONDITION_TYPE = {
  CART_SUBTOTAL_MIN: 'cart_subtotal_min',
  CART_CONTAINS_PRODUCT: 'cart_contains_product',
  CART_CONTAINS_CATEGORY: 'cart_contains_category',
  CUSTOMER_FIRST_TIME: 'customer_first_time',
  PINCODE_IN: 'pincode_in',
} as const;
export type PromotionConditionType =
  (typeof PROMOTION_CONDITION_TYPE)[keyof typeof PROMOTION_CONDITION_TYPE];

// Actions a promotion takes when its conditions match. Same JSON storage +
// discriminated-union pattern as conditions.
export const PROMOTION_ACTION_TYPE = {
  PERCENT_OFF_ORDER: 'percent_off_order',
  FLAT_OFF_ORDER: 'flat_off_order',
  PERCENT_OFF_PRODUCTS: 'percent_off_products',
  FLAT_OFF_PRODUCTS: 'flat_off_products',
  FREE_SHIPPING: 'free_shipping',
} as const;
export type PromotionActionType =
  (typeof PROMOTION_ACTION_TYPE)[keyof typeof PROMOTION_ACTION_TYPE];

// Returned by /cart/evaluate so the storefront can render "Code applied" vs
// the specific reason a code didn't take.
export const COUPON_STATUS = {
  NONE: 'none',
  APPLIED: 'applied',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  LIMIT_REACHED: 'limit_reached',
  WRONG_CART: 'wrong_cart',
  INACTIVE_PROMOTION: 'inactive_promotion',
} as const;
export type CouponStatus = (typeof COUPON_STATUS)[keyof typeof COUPON_STATUS];

// How a discount line was sourced — automatic promotions show up silently
// while coupon-gated ones carry the redeemed code on the line.
export const PROMOTION_SOURCE = {
  AUTOMATIC: 'automatic',
  COUPON: 'coupon',
} as const;
export type PromotionSource = (typeof PROMOTION_SOURCE)[keyof typeof PROMOTION_SOURCE];
