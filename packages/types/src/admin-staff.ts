// Schemas + DTO shapes for the admin staff management endpoints. Used by both
// the api (validation) and the admin app (form types). Module gating lives in
// enums.ts → STAFF_MODULE.

import { z } from 'zod';
import { ADMIN_ROLE, STAFF_MODULES, type StaffModule } from './enums.js';

// A single admin user as returned from the admin-staff list. `permissions`
// is meaningless for admin-role rows but still returned for symmetry.
export const adminStaffSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum([ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF]),
  permissions: z.array(z.enum(STAFF_MODULES as [StaffModule, ...StaffModule[]])),
  isActive: z.boolean(),
  totpEnabledAt: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminStaff = z.infer<typeof adminStaffSchema>;

export const adminStaffListResponseSchema = z.object({
  items: z.array(adminStaffSchema),
});
export type AdminStaffListResponse = z.infer<typeof adminStaffListResponseSchema>;

// Payload for creating a staff user. Password is set by the admin at creation
// time — no email-invite flow (yet). 8-char min just to keep it sane; the
// staff user can change it from their profile later.
export const createAdminStaffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(128),
  role: z.enum([ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF]).default(ADMIN_ROLE.STAFF),
  permissions: z.array(z.enum(STAFF_MODULES as [StaffModule, ...StaffModule[]])).default([]),
});
export type CreateAdminStaffRequest = z.infer<typeof createAdminStaffSchema>;

// Partial update. All fields optional so the admin form can patch incrementally.
export const updateAdminStaffSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  role: z.enum([ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF]).optional(),
  permissions: z.array(z.enum(STAFF_MODULES as [StaffModule, ...StaffModule[]])).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAdminStaffRequest = z.infer<typeof updateAdminStaffSchema>;

// Password reset by ADMIN. Used when staff forgets — admin sets a new
// temporary password and shares out-of-band. Avoids needing an email-link
// flow for the MVP.
export const resetAdminStaffPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});
export type ResetAdminStaffPasswordRequest = z.infer<typeof resetAdminStaffPasswordSchema>;
