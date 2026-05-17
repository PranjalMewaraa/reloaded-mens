// Sprint 4 — cart, checkout, order, payment, coupon DTOs.
// Shared between the storefront (client-side validation) and the API (ZodValidationPipe).

import { z } from 'zod';
import { ORDER_STATE, PAYMENT_PROVIDER, PAYMENT_STATE } from './enums.js';
import { couponCodeSchema } from './promotions.js';
import { emailSchema, phoneSchema, pincodeSchema } from './schemas.js';

// =====================================================
// Cart payload (client → server on order create)
// =====================================================

export const cartItemPayloadSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive().max(20),
});
export type CartItemPayload = z.infer<typeof cartItemPayloadSchema>;

// =====================================================
// Contact + address snapshots
// =====================================================

export const contactInfoSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  email: emailSchema.optional(),
});
export type ContactInfo = z.infer<typeof contactInfoSchema>;

export const shippingAddressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  pincode: pincodeSchema,
  country: z.string().trim().min(2).max(2).default('IN'),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

// =====================================================
// Order creation request/response
// =====================================================

export const createOrderRequestSchema = z.object({
  // UUID generated client-side and cached in localStorage so retries reuse the same key.
  idempotencyKey: z.string().uuid(),
  contact: contactInfoSchema,
  shippingAddress: shippingAddressSchema,
  items: z.array(cartItemPayloadSchema).min(1).max(50),
  couponCode: couponCodeSchema.optional(),
  customerNote: z.string().trim().max(500).optional(),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const paymentSessionSchema = z.object({
  provider: z.enum([PAYMENT_PROVIDER.MOCK, PAYMENT_PROVIDER.PHONEPE]),
  sessionId: z.string(),
  // Relative path the storefront should redirect the customer to. The mock returns
  // /checkout/processing?session=...; PhonePe (Sprint 10) returns its hosted page URL.
  redirectUrl: z.string(),
  amountPaisa: z.number().int().nonnegative(),
});
export type PaymentSession = z.infer<typeof paymentSessionSchema>;

export const createOrderResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  paymentSession: paymentSessionSchema,
});
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

// =====================================================
// Order detail (for /checkout/success and admin display)
// =====================================================

export const orderItemSnapshotSchema = z.object({
  id: z.string(),
  productName: z.string(),
  variantLabel: z.string().nullable(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPricePaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
});
export type OrderItemSnapshot = z.infer<typeof orderItemSnapshotSchema>;

export const orderSnapshotSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  // Sprint 5 — public tracking URL token. Always present on Sprint 5+ orders;
  // null only on historical Sprint 4 orders created before the migration.
  trackingToken: z.string().nullable(),
  state: z.enum([
    ORDER_STATE.PLACED,
    ORDER_STATE.PAYMENT_PENDING,
    ORDER_STATE.PAYMENT_FAILED,
    ORDER_STATE.CONFIRMED,
    ORDER_STATE.PACKED,
    ORDER_STATE.SHIPPED,
    ORDER_STATE.OUT_FOR_DELIVERY,
    ORDER_STATE.DELIVERED,
    ORDER_STATE.CANCELLED,
    ORDER_STATE.RETURN_REQUESTED,
    ORDER_STATE.RETURNED,
    ORDER_STATE.REFUNDED,
  ]),
  paymentState: z.enum([
    PAYMENT_STATE.PENDING,
    PAYMENT_STATE.PAID,
    PAYMENT_STATE.FAILED,
    PAYMENT_STATE.REFUNDED,
    PAYMENT_STATE.PARTIALLY_REFUNDED,
  ]),
  subtotalPaisa: z.number().int().nonnegative(),
  discountPaisa: z.number().int().nonnegative(),
  shippingPaisa: z.number().int().nonnegative(),
  taxPaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
  appliedCouponCode: z.string().nullable(),
  // Sprint 7 — Promotion ids stamped at order placement. Admin order detail
  // looks each one up by id to render the totals breakdown.
  appliedPromotionIds: z.array(z.string()).default([]),
  contact: contactInfoSchema,
  shippingAddress: shippingAddressSchema,
  etaDateFrom: z.string().nullable(), // ISO
  etaDateTo: z.string().nullable(), // ISO
  placedAt: z.string(), // ISO
  confirmedAt: z.string().nullable(), // ISO
  items: z.array(orderItemSnapshotSchema),
});
export type OrderSnapshot = z.infer<typeof orderSnapshotSchema>;

// =====================================================
// Payment webhook + status polling
// =====================================================

export const paymentStatusResponseSchema = z.object({
  sessionId: z.string(),
  status: z.enum(['pending', 'captured', 'failed']),
  orderNumber: z.string().nullable(),
});
export type PaymentStatusResponse = z.infer<typeof paymentStatusResponseSchema>;

export const mockWebhookEventSchema = z.object({
  sessionId: z.string(),
  status: z.enum(['captured', 'failed']),
  // Mock provider signs `${sessionId}.${status}` with HMAC-SHA256. Real PhonePe will
  // replace this with X-VERIFY in Sprint 10.
  signature: z.string(),
});
export type MockWebhookEvent = z.infer<typeof mockWebhookEventSchema>;
