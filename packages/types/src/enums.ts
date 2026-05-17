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
