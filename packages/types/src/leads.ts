// Sprint 8 — Lead capture DTOs. Storefront /contact form creates manual-source
// leads. Sprint 11 Meta webhook hits the same service with source='meta_lead_ads'.

import { z } from 'zod';
import { LEAD_SOURCE, LEAD_STATUS } from './enums.js';
import { paginationSchema, phoneSchema } from './schemas.js';

export const leadSourceSchema = z.enum([
  LEAD_SOURCE.META_LEAD_ADS,
  LEAD_SOURCE.WHATSAPP,
  LEAD_SOURCE.WEBSITE_SIGNUP,
  LEAD_SOURCE.MANUAL,
]);

export const leadStatusSchema = z.enum([
  LEAD_STATUS.NEW,
  LEAD_STATUS.CONTACTED,
  LEAD_STATUS.QUALIFIED,
  LEAD_STATUS.CONVERTED,
  LEAD_STATUS.LOST,
]);

// =====================================================
// Public create (POST /public/leads)
// =====================================================

export const createLeadSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: phoneSchema.optional(),
    email: z.string().email().toLowerCase().optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .refine((d) => d.phone || d.email, {
    message: 'At least one of phone or email is required',
    path: ['phone'],
  });
export type CreateLeadRequest = z.infer<typeof createLeadSchema>;

// =====================================================
// Admin
// =====================================================

export const adminLeadListQuerySchema = paginationSchema.extend({
  status: leadStatusSchema.optional(),
  source: leadSourceSchema.optional(),
  q: z.string().trim().max(120).optional(),
});
export type AdminLeadListQuery = z.infer<typeof adminLeadListQuerySchema>;

export const updateLeadSchema = z.object({
  status: leadStatusSchema.optional(),
  internalNote: z.string().max(2000).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(120).optional().nullable(),
});
export type UpdateLeadRequest = z.infer<typeof updateLeadSchema>;

// =====================================================
// Response shapes
// =====================================================

export const leadSummarySchema = z.object({
  id: z.string(),
  source: z.string(),
  status: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  message: z.string().nullable(),
  internalNote: z.string().nullable(),
  assignedToId: z.string().nullable(),
  assignedToName: z.string().nullable(),
  contactedAt: z.string().nullable(),
  convertedAt: z.string().nullable(),
  convertedOrderId: z.string().nullable(),
  createdAt: z.string(),
});
export type LeadSummary = z.infer<typeof leadSummarySchema>;

export const leadListResponseSchema = z.object({
  items: z.array(leadSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type LeadListResponse = z.infer<typeof leadListResponseSchema>;
