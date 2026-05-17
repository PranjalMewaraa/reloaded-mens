// Sprint 7 — Promotion + Coupon + cart-evaluate DTOs.
// Shared between the storefront (cart/checkout), admin (editor), and API
// (ZodValidationPipe + engine input/output types).

import { z } from 'zod';
import {
  COUPON_STATUS,
  PROMOTION_ACTION_TYPE,
  PROMOTION_CONDITION_TYPE,
  PROMOTION_SOURCE,
} from './enums.js';
import { paginationSchema, paisaSchema, phoneSchema, pincodeSchema } from './schemas.js';

// =====================================================
// Condition + Action discriminated unions
// =====================================================
// Persisted as JSON on Promotion.conditions / Promotion.actions. Discriminated
// by `type`; admin UI renders one editor per branch.

export const promotionConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(PROMOTION_CONDITION_TYPE.CART_SUBTOTAL_MIN),
    amountPaisa: paisaSchema,
  }),
  z.object({
    type: z.literal(PROMOTION_CONDITION_TYPE.CART_CONTAINS_PRODUCT),
    productIds: z.array(z.string().min(1)).min(1).max(200),
  }),
  z.object({
    type: z.literal(PROMOTION_CONDITION_TYPE.CART_CONTAINS_CATEGORY),
    categoryIds: z.array(z.string().min(1)).min(1).max(50),
  }),
  z.object({
    type: z.literal(PROMOTION_CONDITION_TYPE.CUSTOMER_FIRST_TIME),
  }),
  z.object({
    type: z.literal(PROMOTION_CONDITION_TYPE.PINCODE_IN),
    pincodes: z.array(pincodeSchema).min(1).max(500),
  }),
]);
export type PromotionCondition = z.infer<typeof promotionConditionSchema>;

export const promotionActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(PROMOTION_ACTION_TYPE.PERCENT_OFF_ORDER),
    percent: z.number().int().min(1).max(100),
  }),
  z.object({
    type: z.literal(PROMOTION_ACTION_TYPE.FLAT_OFF_ORDER),
    amountPaisa: paisaSchema.refine((v) => v > 0, 'Amount must be positive'),
  }),
  z.object({
    type: z.literal(PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS),
    percent: z.number().int().min(1).max(100),
    productIds: z.array(z.string().min(1)).min(1).max(200),
  }),
  z.object({
    type: z.literal(PROMOTION_ACTION_TYPE.FLAT_OFF_PRODUCTS),
    amountPaisa: paisaSchema.refine((v) => v > 0, 'Amount must be positive'),
    productIds: z.array(z.string().min(1)).min(1).max(200),
  }),
  z.object({
    type: z.literal(PROMOTION_ACTION_TYPE.FREE_SHIPPING),
  }),
]);
export type PromotionAction = z.infer<typeof promotionActionSchema>;

// =====================================================
// Admin CRUD payloads
// =====================================================

const datetimeOrEmpty = z
  .union([z.string().datetime(), z.string().length(0), z.null()])
  .transform((v) => (v && v.length > 0 ? v : null));

export const createPromotionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    isAutomatic: z.boolean().default(false),
    isActive: z.boolean().default(true),
    stackable: z.boolean().default(false),
    stackPriority: z.number().int().min(0).max(999).default(100),
    validFrom: datetimeOrEmpty.optional(),
    validTo: datetimeOrEmpty.optional(),
    conditions: z.array(promotionConditionSchema).max(20).default([]),
    actions: z.array(promotionActionSchema).min(1).max(10),
  })
  .superRefine((data, ctx) => {
    if (data.validFrom && data.validTo && new Date(data.validFrom) > new Date(data.validTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validFrom must be before validTo',
        path: ['validTo'],
      });
    }
  });
export type CreatePromotionRequest = z.infer<typeof createPromotionSchema>;

export const updatePromotionSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  isAutomatic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  stackable: z.boolean().optional(),
  stackPriority: z.number().int().min(0).max(999).optional(),
  validFrom: datetimeOrEmpty.optional(),
  validTo: datetimeOrEmpty.optional(),
  conditions: z.array(promotionConditionSchema).max(20).optional(),
  actions: z.array(promotionActionSchema).min(1).max(10).optional(),
});
export type UpdatePromotionRequest = z.infer<typeof updatePromotionSchema>;

export const promotionListQuerySchema = paginationSchema.extend({
  isAutomatic: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  q: z.string().trim().max(120).optional(),
});
export type PromotionListQuery = z.infer<typeof promotionListQuerySchema>;

// =====================================================
// Coupon payloads
// =====================================================

// Reuse the storefront-friendly code regex (no spaces, A-Z 0-9 - _).
export const couponCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9-_]+$/, 'Use letters, digits, hyphens or underscores')
  .transform((v) => v.toUpperCase());

export const singleCouponCreateSchema = z.object({
  code: couponCodeSchema,
  usageLimitTotal: z.number().int().nonnegative().default(0),
  usageLimitPerCustomer: z.number().int().nonnegative().default(1),
  batchLabel: z.string().trim().max(80).optional(),
});
export type SingleCouponCreate = z.infer<typeof singleCouponCreateSchema>;

export const generateCouponsSchema = z.object({
  count: z.number().int().min(1).max(1000),
  prefix: z
    .string()
    .trim()
    .max(8)
    .regex(/^[A-Za-z0-9]*$/, 'Prefix may only contain letters and digits')
    .optional(),
  length: z.number().int().min(6).max(16).default(10),
  batchLabel: z.string().trim().max(80).optional(),
  usageLimitTotal: z.number().int().nonnegative().default(1),
  usageLimitPerCustomer: z.number().int().nonnegative().default(1),
});
export type GenerateCouponsRequest = z.infer<typeof generateCouponsSchema>;

export const couponListQuerySchema = paginationSchema.extend({
  batch: z.string().trim().max(80).optional(),
});
export type CouponListQuery = z.infer<typeof couponListQuerySchema>;

// =====================================================
// Response shapes
// =====================================================

export const promotionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isAutomatic: z.boolean(),
  isActive: z.boolean(),
  stackable: z.boolean(),
  stackPriority: z.number().int(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  usageCount: z.number().int().nonnegative(),
  couponCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type PromotionSummary = z.infer<typeof promotionSummarySchema>;

export const couponSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  isActive: z.boolean(),
  usageCount: z.number().int().nonnegative(),
  usageLimitTotal: z.number().int().nonnegative(),
  usageLimitPerCustomer: z.number().int().nonnegative(),
  batchLabel: z.string().nullable(),
  createdAt: z.string(),
});
export type CouponSummary = z.infer<typeof couponSummarySchema>;

export const promotionDetailSchema = promotionSummarySchema.extend({
  conditions: z.array(promotionConditionSchema),
  actions: z.array(promotionActionSchema),
  coupons: z.array(couponSummarySchema),
});
export type PromotionDetail = z.infer<typeof promotionDetailSchema>;

// Returned by bulk-generate so the admin can download a CSV in the browser.
export const bulkCouponGenerateResponseSchema = z.object({
  generated: z.array(couponSummarySchema),
  batchLabel: z.string().nullable(),
});
export type BulkCouponGenerateResponse = z.infer<typeof bulkCouponGenerateResponseSchema>;

// =====================================================
// Cart-evaluate
// =====================================================

export const cartEvaluateLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive().max(20),
});
export type CartEvaluateLine = z.infer<typeof cartEvaluateLineSchema>;

export const cartEvaluateRequestSchema = z.object({
  lines: z.array(cartEvaluateLineSchema).min(1).max(50),
  couponCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : undefined)),
  pincode: pincodeSchema.optional(),
  phone: phoneSchema.optional(),
});
export type CartEvaluateRequest = z.infer<typeof cartEvaluateRequestSchema>;

export const cartEvaluateDiscountLineSchema = z.object({
  promotionId: z.string(),
  promotionName: z.string(),
  source: z.enum([PROMOTION_SOURCE.AUTOMATIC, PROMOTION_SOURCE.COUPON]),
  couponCode: z.string().nullable(),
  // Always a positive integer here (the savings the customer sees on the row).
  amountPaisa: z.number().int().nonnegative(),
  description: z.string(),
});
export type CartEvaluateDiscountLine = z.infer<typeof cartEvaluateDiscountLineSchema>;

export const cartEvaluateResponseSchema = z.object({
  subtotalPaisa: z.number().int().nonnegative(),
  shippingPaisa: z.number().int().nonnegative(),
  discountLines: z.array(cartEvaluateDiscountLineSchema),
  totalDiscountPaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
  freeShipping: z.boolean(),
  couponStatus: z.enum([
    COUPON_STATUS.NONE,
    COUPON_STATUS.APPLIED,
    COUPON_STATUS.INVALID,
    COUPON_STATUS.EXPIRED,
    COUPON_STATUS.LIMIT_REACHED,
    COUPON_STATUS.WRONG_CART,
    COUPON_STATUS.INACTIVE_PROMOTION,
  ]),
  // Human-readable reason when couponStatus !== 'applied' && !== 'none'.
  couponMessage: z.string().nullable(),
});
export type CartEvaluateResponse = z.infer<typeof cartEvaluateResponseSchema>;
