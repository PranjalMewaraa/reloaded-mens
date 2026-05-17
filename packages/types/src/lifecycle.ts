// Sprint 5 — order lifecycle DTOs.
// Shared between the admin (server actions + react-hook-form), the API
// (ZodValidationPipe), and the storefront tracking page.

import { z } from 'zod';
import { ORDER_STATE, PAYMENT_STATE, REFUND_STATUS } from './enums.js';
import { paisaSchema, paginationSchema } from './schemas.js';
import { contactInfoSchema, orderItemSnapshotSchema, shippingAddressSchema } from './checkout.js';

// =====================================================
// Order state transitions
// =====================================================

// Targets the admin can move an order to via POST /orders/:id/transition. 'cancelled'
// has its own dedicated endpoint (POST /orders/:id/cancel) because it needs the reason
// + restock toggle; including it here would silently bypass that contract.
export const orderTransitionTargetSchema = z.enum([
  ORDER_STATE.CONFIRMED,
  ORDER_STATE.PACKED,
  ORDER_STATE.SHIPPED,
  ORDER_STATE.OUT_FOR_DELIVERY,
  ORDER_STATE.DELIVERED,
]);
export type OrderTransitionTarget = z.infer<typeof orderTransitionTargetSchema>;

export const transitionOrderRequestSchema = z.object({
  target: orderTransitionTargetSchema,
  // Required when target=shipped. The admin UI exposes an "Auto-generate (mock)" button
  // that fills this in via the shipping provider; the API will also auto-fill if absent
  // when target=shipped to keep the contract permissive.
  trackingNumber: z.string().trim().min(3).max(64).optional(),
  // Free-form note attached to the OrderEvent.
  message: z.string().trim().max(500).optional(),
});
export type TransitionOrderRequest = z.infer<typeof transitionOrderRequestSchema>;

export const cancelOrderRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  // Whether to re-increment ProductVariant.stockCount + write InventoryEvent rows.
  // Admin can untick when cancelling for fraud — fraudulent orders shouldn't return
  // their stock to the saleable pool.
  restock: z.boolean().default(true),
});
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;

export const customerCancelRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CustomerCancelRequest = z.infer<typeof customerCancelRequestSchema>;

// =====================================================
// Internal note
// =====================================================

export const updateInternalNoteSchema = z.object({
  note: z.string().max(2000),
});
export type UpdateInternalNoteRequest = z.infer<typeof updateInternalNoteSchema>;

// =====================================================
// Admin order list query
// =====================================================

export const adminOrderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  state: z
    .enum([
      ORDER_STATE.PAYMENT_PENDING,
      ORDER_STATE.CONFIRMED,
      ORDER_STATE.PACKED,
      ORDER_STATE.SHIPPED,
      ORDER_STATE.OUT_FOR_DELIVERY,
      ORDER_STATE.DELIVERED,
      ORDER_STATE.CANCELLED,
      ORDER_STATE.PAYMENT_FAILED,
      ORDER_STATE.RETURN_REQUESTED,
      ORDER_STATE.RETURNED,
      ORDER_STATE.REFUNDED,
    ])
    .optional(),
  paymentState: z
    .enum([
      PAYMENT_STATE.PENDING,
      PAYMENT_STATE.PAID,
      PAYMENT_STATE.FAILED,
      PAYMENT_STATE.REFUNDED,
      PAYMENT_STATE.PARTIALLY_REFUNDED,
    ])
    .optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

// =====================================================
// Refunds
// =====================================================

export const createRefundRequestSchema = z.object({
  orderId: z.string().min(1),
  // Always full-order refund this sprint. Server validates amount matches order.totalPaisa.
  amountPaisa: paisaSchema,
  reason: z.string().trim().min(3).max(500),
});
export type CreateRefundRequest = z.infer<typeof createRefundRequestSchema>;

export const rejectRefundSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type RejectRefundRequest = z.infer<typeof rejectRefundSchema>;

export const refundListQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      REFUND_STATUS.PENDING_ADMIN_APPROVAL,
      REFUND_STATUS.APPROVED,
      REFUND_STATUS.REJECTED,
      REFUND_STATUS.COMPLETED,
    ])
    .optional(),
});
export type RefundListQuery = z.infer<typeof refundListQuerySchema>;

// =====================================================
// Order timeline event shape (response from admin detail + tracking)
// =====================================================

export const orderEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  message: z.string().nullable(),
  actor: z.enum(['system', 'customer', 'staff', 'admin']),
  actorId: z.string().nullable(),
  payload: z.record(z.unknown()).nullable(),
  createdAt: z.string(), // ISO
});
export type OrderEventResponse = z.infer<typeof orderEventSchema>;

// =====================================================
// Full admin order detail shape
// =====================================================

const refundSummarySchema = z.object({
  id: z.string(),
  refundNumber: z.string(),
  status: z.enum([
    REFUND_STATUS.PENDING_ADMIN_APPROVAL,
    REFUND_STATUS.APPROVED,
    REFUND_STATUS.REJECTED,
    REFUND_STATUS.COMPLETED,
  ]),
  amountPaisa: z.number().int().nonnegative(),
  reason: z.string(),
  requestedBy: z.string(),
  approvedBy: z.string().nullable(),
  rejectedReason: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const adminOrderDetailSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  state: z.string(),
  paymentState: z.string(),
  subtotalPaisa: z.number().int().nonnegative(),
  discountPaisa: z.number().int().nonnegative(),
  shippingPaisa: z.number().int().nonnegative(),
  taxPaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
  appliedCouponCode: z.string().nullable(),
  // Sprint 7 — promotion ids stamped at order placement. Admin order detail
  // resolves each one to a name + chip via /admin-promotions/:id.
  appliedPromotionIds: z.array(z.string()).default([]),
  contact: contactInfoSchema,
  shippingAddress: shippingAddressSchema,
  internalNote: z.string().nullable(),
  customerNote: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  trackingToken: z.string().nullable(),
  etaDateFrom: z.string().nullable(),
  etaDateTo: z.string().nullable(),
  placedAt: z.string(),
  confirmedAt: z.string().nullable(),
  packedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  outForDeliveryAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  items: z.array(orderItemSnapshotSchema),
  events: z.array(orderEventSchema),
  refunds: z.array(refundSummarySchema),
  payment: z
    .object({
      id: z.string(),
      provider: z.string(),
      status: z.string(),
      amountPaisa: z.number().int().nonnegative(),
      capturedAt: z.string().nullable(),
    })
    .nullable(),
});
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

export const adminOrderListItemSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  state: z.string(),
  paymentState: z.string(),
  totalPaisa: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  placedAt: z.string(),
  lastEventAt: z.string(),
});
export type AdminOrderListItem = z.infer<typeof adminOrderListItemSchema>;

// =====================================================
// Storefront tracking response — strict subset of admin detail
// =====================================================

export const trackingOrderSchema = z.object({
  orderNumber: z.string(),
  state: z.string(),
  paymentState: z.string(),
  totalPaisa: z.number().int().nonnegative(),
  subtotalPaisa: z.number().int().nonnegative(),
  discountPaisa: z.number().int().nonnegative(),
  shippingPaisa: z.number().int().nonnegative(),
  taxPaisa: z.number().int().nonnegative(),
  appliedCouponCode: z.string().nullable(),
  contact: contactInfoSchema,
  shippingAddress: shippingAddressSchema,
  trackingNumber: z.string().nullable(),
  etaDateFrom: z.string().nullable(),
  etaDateTo: z.string().nullable(),
  placedAt: z.string(),
  confirmedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  items: z.array(orderItemSnapshotSchema),
  events: z.array(orderEventSchema), // customer-safe types only — server filters
  canCustomerCancel: z.boolean(),
});
export type TrackingOrder = z.infer<typeof trackingOrderSchema>;
