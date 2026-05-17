'use server';

import { revalidatePath } from 'next/cache';
import {
  approveReturnSchema,
  cancelReturnRequestSchema,
  markReceivedSchema,
  rejectReturnSchema,
  updateReturnNoteSchema,
  verifyReturnRequestSchema,
  type ApproveReturnRequest,
  type CancelReturnRequest,
  type MarkReceivedRequest,
  type RejectReturnRequest,
  type UpdateReturnNoteRequest,
  type VerifyReturnPayload,
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

function bust(id: string) {
  revalidatePath(`/orders/returns/${id}`);
  revalidatePath('/orders/returns');
  revalidatePath('/dashboard');
}

export async function approveReturnAction(id: string, input: ApproveReturnRequest): Promise<ActionResult> {
  const parsed = approveReturnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/admin-returns/${id}/approve`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true };
}

export async function rejectReturnAction(id: string, input: RejectReturnRequest): Promise<ActionResult> {
  const parsed = rejectReturnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/admin-returns/${id}/reject`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true };
}

export async function markReceivedAction(id: string, input: MarkReceivedRequest): Promise<ActionResult> {
  const parsed = markReceivedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/admin-returns/${id}/mark-received`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true };
}

export async function verifyReturnAction(id: string, input: VerifyReturnPayload): Promise<ActionResult> {
  const parsed = verifyReturnRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/admin-returns/${id}/verify`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  revalidatePath('/orders/refunds');
  return { ok: true };
}

export async function markCompletedAction(id: string): Promise<ActionResult> {
  const res = await api(`/admin-returns/${id}/mark-completed`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true };
}

export async function adminCancelReturnAction(id: string, input: CancelReturnRequest): Promise<ActionResult> {
  const parsed = cancelReturnRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/admin-returns/${id}/cancel`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true };
}

export async function updateReturnNoteAction(id: string, input: UpdateReturnNoteRequest): Promise<ActionResult> {
  const parsed = updateReturnNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/admin-returns/${id}/note`, { method: 'PATCH', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true };
}
