// Sprint 8 — Review DTOs. Submission is token-gated (per-orderItem token sent
// post-delivery). Moderation is admin-side; PDP displays only APPROVED.

import { z } from 'zod';
import { REVIEW_STATUS } from './enums.js';
import { paginationSchema } from './schemas.js';

export const reviewStatusSchema = z.enum([
  REVIEW_STATUS.PENDING,
  REVIEW_STATUS.APPROVED,
  REVIEW_STATUS.REJECTED,
]);

// =====================================================
// Public submission (token-gated)
// =====================================================

export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(10).max(1000),
});
export type SubmitReviewRequest = z.infer<typeof submitReviewSchema>;

// GET /public/reviews/submit pre-fetch — what the storefront form needs to
// render the "review this:" header without leaking other order info.
export const reviewSubmissionPromptSchema = z.object({
  orderItemId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  variantLabel: z.string().nullable(),
  // Customer's saved name (defaults the form's author name field).
  customerName: z.string(),
  // True if a review already exists for this order item (any status).
  alreadySubmitted: z.boolean(),
  // True only when an APPROVED review exists.
  alreadyApproved: z.boolean(),
  // Bumped by the success path so the form can show the "thanks" card.
  submittedRating: z.number().int().nullable(),
});
export type ReviewSubmissionPrompt = z.infer<typeof reviewSubmissionPromptSchema>;

// =====================================================
// Public PDP listing
// =====================================================

export const reviewListItemSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type ReviewListItem = z.infer<typeof reviewListItemSchema>;

export const productReviewsResponseSchema = z.object({
  productId: z.string(),
  averageRating: z.number().nullable(),
  totalCount: z.number().int().nonnegative(),
  histogram: z.object({
    5: z.number().int().nonnegative(),
    4: z.number().int().nonnegative(),
    3: z.number().int().nonnegative(),
    2: z.number().int().nonnegative(),
    1: z.number().int().nonnegative(),
  }),
  items: z.array(reviewListItemSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type ProductReviewsResponse = z.infer<typeof productReviewsResponseSchema>;

export const productReviewsQuerySchema = paginationSchema.extend({
  sort: z.enum(['recent', 'highest', 'lowest']).default('recent'),
});
export type ProductReviewsQuery = z.infer<typeof productReviewsQuerySchema>;

// =====================================================
// Admin moderation
// =====================================================

export const adminReviewListQuerySchema = paginationSchema.extend({
  status: reviewStatusSchema.optional(),
  productId: z.string().optional(),
});
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;

export const rejectReviewSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type RejectReviewRequest = z.infer<typeof rejectReviewSchema>;

export const adminReviewSummarySchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  orderItemId: z.string(),
  orderNumber: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string(),
  body: z.string(),
  status: z.string(),
  rejectedReason: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminReviewSummary = z.infer<typeof adminReviewSummarySchema>;

export const adminReviewListResponseSchema = z.object({
  items: z.array(adminReviewSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type AdminReviewListResponse = z.infer<typeof adminReviewListResponseSchema>;
