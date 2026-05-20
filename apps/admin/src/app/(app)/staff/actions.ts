'use server';

import { revalidatePath } from 'next/cache';
import {
  createAdminStaffSchema,
  resetAdminStaffPasswordSchema,
  updateAdminStaffSchema,
  type AdminStaff,
  type CreateAdminStaffRequest,
  type ResetAdminStaffPasswordRequest,
  type UpdateAdminStaffRequest,
} from '@repo/types';
import { api } from '@/lib/api';

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

function describeError(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Request failed';
  const b = body as { message?: string | string[]; reason?: string };
  if (Array.isArray(b.message)) return b.message.join('; ');
  return b.message ?? b.reason ?? 'Request failed';
}

function bust() {
  revalidatePath('/staff');
}

export async function createStaffAction(
  input: CreateAdminStaffRequest,
): Promise<ActionResult<AdminStaff>> {
  const parsed = createAdminStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api<AdminStaff>('/admin-staff', { method: 'POST', body: parsed.data });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust();
  return { ok: true, data: res.body };
}

export async function updateStaffAction(
  id: string,
  input: UpdateAdminStaffRequest,
): Promise<ActionResult<AdminStaff>> {
  const parsed = updateAdminStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api<AdminStaff>(`/admin-staff/${id}`, { method: 'PATCH', body: parsed.data });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust();
  return { ok: true, data: res.body };
}

export async function resetStaffPasswordAction(
  id: string,
  input: ResetAdminStaffPasswordRequest,
): Promise<ActionResult> {
  const parsed = resetAdminStaffPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api(`/admin-staff/${id}/reset-password`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  return { ok: true };
}

export async function deactivateStaffAction(id: string): Promise<ActionResult> {
  const res = await api(`/admin-staff/${id}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust();
  return { ok: true };
}
