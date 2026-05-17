// Sprint 8 — Customer auth DTOs. Phone → email-OTP → session.
// MSG91 SMS replaces the email channel in Sprint 12 without changing this shape.

import { z } from 'zod';
import { emailSchema, phoneSchema } from './schemas.js';

// =====================================================
// OTP request + verify
// =====================================================

export const requestCustomerOtpSchema = z.object({
  phone: phoneSchema,
});
export type RequestCustomerOtpRequest = z.infer<typeof requestCustomerOtpSchema>;

export const requestCustomerOtpResponseSchema = z.object({
  // Always true — never leak whether the phone exists. Storefront shows the
  // OTP-entry step regardless.
  ok: z.literal(true),
  // Masked destination so the UI can say "Code sent to de***@cubastion.com".
  // Empty string when no destination was on file (dev fallback path).
  deliveredTo: z.string(),
  // Channel used. Always 'email' in MVP; 'sms' lands in Sprint 12.
  channel: z.enum(['email', 'sms']),
  // TTL in seconds — UI uses this for the resend cool-down.
  expiresInSeconds: z.number().int().positive(),
});
export type RequestCustomerOtpResponse = z.infer<typeof requestCustomerOtpResponseSchema>;

export const verifyCustomerOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export type VerifyCustomerOtpRequest = z.infer<typeof verifyCustomerOtpSchema>;

// =====================================================
// Profile shape
// =====================================================

export const customerProfileSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  marketingConsentEmail: z.boolean(),
  marketingConsentSms: z.boolean(),
  marketingConsentWhatsapp: z.boolean(),
  createdAt: z.string(),
});
export type CustomerProfile = z.infer<typeof customerProfileSchema>;

export const verifyCustomerOtpResponseSchema = z.object({
  customer: customerProfileSchema,
});
export type VerifyCustomerOtpResponse = z.infer<typeof verifyCustomerOtpResponseSchema>;

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: emailSchema.optional().nullable(),
  marketingConsentEmail: z.boolean().optional(),
  marketingConsentSms: z.boolean().optional(),
  marketingConsentWhatsapp: z.boolean().optional(),
});
export type UpdateCustomerProfileRequest = z.infer<typeof updateCustomerProfileSchema>;

// =====================================================
// Customer order list (for /account/orders)
// =====================================================

export const customerOrderListItemSchema = z.object({
  orderNumber: z.string(),
  state: z.string(),
  paymentState: z.string(),
  totalPaisa: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  primaryProductName: z.string(),
  placedAt: z.string(),
  trackingToken: z.string().nullable(),
});
export type CustomerOrderListItem = z.infer<typeof customerOrderListItemSchema>;

export const customerOrderListResponseSchema = z.object({
  items: z.array(customerOrderListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type CustomerOrderListResponse = z.infer<typeof customerOrderListResponseSchema>;
