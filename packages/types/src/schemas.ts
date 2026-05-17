import { z } from 'zod';

// Indian phone number — +91 followed by 10 digits, normalized form.
export const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, 'Phone must be in +91XXXXXXXXXX format');

// Indian pincode — 6 digits, first digit 1-9.
export const pincodeSchema = z.string().regex(/^[1-9]\d{5}$/, 'Invalid pincode');

// Money stored as integer paisa (1 INR = 100 paisa).
// Always work in paisa server-side to avoid float precision bugs.
export const paisaSchema = z.number().int().nonnegative();

// Email — optional in many places, so provide a nullable variant too.
export const emailSchema = z.string().email().toLowerCase();
export const optionalEmailSchema = emailSchema.optional().nullable();

// Slug — URL-safe, lowercase, hyphen-separated.
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only');

// Pagination input used on every list endpoint.
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

// =====================================================
// Admin auth DTOs (Sprint 1)
// =====================================================

// Email + password, the first step of admin login.
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Six-digit TOTP code, used by /auth/totp/enroll and /auth/totp/verify.
export const totpCodeSchema = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');

export const totpVerifyRequestSchema = z.object({
  code: totpCodeSchema,
});
export type TotpVerifyRequest = z.infer<typeof totpVerifyRequestSchema>;
