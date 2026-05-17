// Sprint 6 — return + exchange DTOs.
// Shared between the storefront (return flow) and the API (ZodValidationPipe).

import { z } from 'zod';
import {
  RESTOCK_DECISION,
  RETURN_METHOD,
  RETURN_REASON,
  RETURN_STATE,
  RETURN_TYPE,
  VERIFIED_CONDITION,
} from './enums.js';
import { paginationSchema } from './schemas.js';

// =====================================================
// Enum schemas
// =====================================================

export const returnMethodSchema = z.enum([
  RETURN_METHOD.COURIER_PICKUP,
  RETURN_METHOD.STORE_DROPOFF,
]);
export type ReturnMethodValue = z.infer<typeof returnMethodSchema>;

export const returnActionSchema = z.enum([
  RETURN_TYPE.RETURN,
  RETURN_TYPE.EXCHANGE,
  RETURN_TYPE.REPLACEMENT,
]);
export type ReturnAction = z.infer<typeof returnActionSchema>;

export const returnReasonSchema = z.enum([
  RETURN_REASON.SIZE_ISSUE,
  RETURN_REASON.QUALITY,
  RETURN_REASON.NOT_AS_EXPECTED,
  RETURN_REASON.DAMAGED,
  RETURN_REASON.OTHER,
]);
export type ReturnReasonValue = z.infer<typeof returnReasonSchema>;

export const returnStateSchema = z.enum([
  RETURN_STATE.REQUESTED,
  RETURN_STATE.APPROVED,
  RETURN_STATE.REJECTED,
  RETURN_STATE.PICKUP_SCHEDULED,
  RETURN_STATE.STORE_DROPOFF_PENDING,
  RETURN_STATE.IN_TRANSIT,
  RETURN_STATE.RECEIVED,
  RETURN_STATE.VERIFIED,
  RETURN_STATE.COMPLETED,
  RETURN_STATE.CANCELLED,
]);
export type ReturnStateValue = z.infer<typeof returnStateSchema>;

export const verifiedConditionSchema = z.enum([
  VERIFIED_CONDITION.AS_NEW,
  VERIFIED_CONDITION.USED,
  VERIFIED_CONDITION.DAMAGED,
]);

export const restockDecisionSchema = z.enum([
  RESTOCK_DECISION.RESTOCK,
  RESTOCK_DECISION.DAMAGE_WRITEOFF,
  RESTOCK_DECISION.PENDING,
]);

// =====================================================
// Eligibility (GET /public/tracking/:orderNumber/returnable)
// =====================================================

export const returnableItemSchema = z.object({
  orderItemId: z.string(),
  variantId: z.string(),
  productName: z.string(),
  variantLabel: z.string().nullable(),
  sku: z.string(),
  unitPricePaisa: z.number().int().nonnegative(),
  quantityOrdered: z.number().int().nonnegative(),
  // Quantity bought minus the quantity already bound to an open ReturnRequest.
  returnableQuantity: z.number().int().nonnegative(),
  // Slug so the storefront can fetch sibling variants for the exchange picker.
  productSlug: z.string(),
});
export type ReturnableItem = z.infer<typeof returnableItemSchema>;

export const returnEligibilityResponseSchema = z.object({
  orderNumber: z.string(),
  withinWindow: z.boolean(),
  daysRemaining: z.number().int().nonnegative(),
  windowDays: z.number().int().nonnegative(),
  items: z.array(returnableItemSchema),
  // The number of currently open (non-terminal) returns for this order. The
  // storefront uses it to decide whether to render the start-a-return CTA or the
  // open-return banner.
  openReturnNumber: z.string().nullable(),
});
export type ReturnEligibilityResponse = z.infer<typeof returnEligibilityResponseSchema>;

// =====================================================
// Photo upload (POST /public/tracking/:orderNumber/return-photo)
// =====================================================

export const returnPhotoUploadResponseSchema = z.object({
  url: z.string().url(),
  key: z.string(),
});
export type ReturnPhotoUploadResponse = z.infer<typeof returnPhotoUploadResponseSchema>;

// =====================================================
// Create / cancel (POST /public/tracking/:orderNumber/return*)
// =====================================================

export const returnLineItemInputSchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.number().int().positive().max(20),
  reason: returnReasonSchema,
  reasonNote: z.string().trim().max(500).optional(),
  action: returnActionSchema,
  // Required when action is 'exchange' — must reference a variant of the same
  // product. Server re-validates against the product.
  exchangeVariantId: z.string().min(1).optional(),
  // Image URLs returned by /return-photo. Up to 5 photos per line.
  photoUrls: z.array(z.string().url()).max(5).default([]),
});
export type ReturnLineItemInput = z.infer<typeof returnLineItemInputSchema>;

export const createReturnRequestSchema = z.object({
  method: returnMethodSchema,
  customerNote: z.string().trim().max(500).optional(),
  items: z.array(returnLineItemInputSchema).min(1).max(20),
});
export type CreateReturnRequest = z.infer<typeof createReturnRequestSchema>;

export const cancelReturnRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelReturnRequest = z.infer<typeof cancelReturnRequestSchema>;

// =====================================================
// Admin (POST /admin-returns/*)
// =====================================================

export const adminReturnListQuerySchema = paginationSchema.extend({
  state: returnStateSchema.optional(),
});
export type AdminReturnListQuery = z.infer<typeof adminReturnListQuerySchema>;

export const approveReturnSchema = z.object({
  // ISO date — if provided + method=courier_pickup, transitions straight to
  // pickup_scheduled. Otherwise just transitions to approved.
  pickupScheduledAt: z.string().datetime().optional(),
  internalNote: z.string().trim().max(500).optional(),
});
export type ApproveReturnRequest = z.infer<typeof approveReturnSchema>;

export const rejectReturnSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type RejectReturnRequest = z.infer<typeof rejectReturnSchema>;

export const markReceivedSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type MarkReceivedRequest = z.infer<typeof markReceivedSchema>;

export const verifyReturnLineSchema = z.object({
  returnLineItemId: z.string().min(1),
  verifiedCondition: verifiedConditionSchema,
  restockDecision: restockDecisionSchema,
});
export type VerifyReturnLine = z.infer<typeof verifyReturnLineSchema>;

export const verifyReturnRequestSchema = z.object({
  lines: z.array(verifyReturnLineSchema).min(1),
  // When true (and any line has action='return'), auto-create a pending RefundRequest.
  triggerRefund: z.boolean().default(true),
  internalNote: z.string().trim().max(500).optional(),
});
export type VerifyReturnPayload = z.infer<typeof verifyReturnRequestSchema>;

export const updateReturnNoteSchema = z.object({
  note: z.string().max(2000),
});
export type UpdateReturnNoteRequest = z.infer<typeof updateReturnNoteSchema>;

// =====================================================
// Response shapes
// =====================================================

export const returnLineSnapshotSchema = z.object({
  id: z.string(),
  orderItemId: z.string(),
  variantId: z.string(),
  productName: z.string(),
  variantLabel: z.string().nullable(),
  sku: z.string(),
  unitPricePaisa: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  reason: z.string(),
  reasonNote: z.string().nullable(),
  action: z.string(),
  exchangeVariantId: z.string().nullable(),
  exchangeVariantLabel: z.string().nullable(),
  verifiedCondition: z.string().nullable(),
  restockDecision: z.string(),
  photoUrls: z.array(z.string()),
  exchangeReservedUntil: z.string().nullable(),
});
export type ReturnLineSnapshot = z.infer<typeof returnLineSnapshotSchema>;

const baseReturnFields = {
  id: z.string(),
  returnNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  state: z.string(),
  method: z.string(),
  customerNote: z.string().nullable(),
  rejectedReason: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  pickupScheduledAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  createdAt: z.string(),
  items: z.array(returnLineSnapshotSchema),
};

export const adminReturnDetailSchema = z.object({
  ...baseReturnFields,
  internalNote: z.string().nullable(),
  refundRequestId: z.string().nullable(),
  refundRequestNumber: z.string().nullable(),
  customerName: z.string(),
  customerPhone: z.string(),
});
export type AdminReturnDetail = z.infer<typeof adminReturnDetailSchema>;

export const adminReturnListItemSchema = z.object({
  id: z.string(),
  returnNumber: z.string(),
  orderNumber: z.string(),
  customerName: z.string(),
  state: z.string(),
  method: z.string(),
  itemCount: z.number().int().nonnegative(),
  primaryPhotoUrls: z.array(z.string()), // up to 3 for the card preview
  createdAt: z.string(),
});
export type AdminReturnListItem = z.infer<typeof adminReturnListItemSchema>;

export const customerReturnSummarySchema = z.object({
  ...baseReturnFields,
  // canCustomerCancel — boolean derived server-side from the state machine.
  canCustomerCancel: z.boolean(),
});
export type CustomerReturnSummary = z.infer<typeof customerReturnSummarySchema>;
