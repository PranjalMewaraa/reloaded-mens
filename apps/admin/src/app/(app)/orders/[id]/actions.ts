'use server';

import { revalidatePath } from 'next/cache';
import {
  cancelOrderRequestSchema,
  createRefundRequestSchema,
  rejectRefundSchema,
  transitionOrderRequestSchema,
  updateInternalNoteSchema,
  type CancelOrderRequest,
  type CreateRefundRequest,
  type RejectRefundRequest,
  type TransitionOrderRequest,
  type UpdateInternalNoteRequest,
} from '@repo/types';
import { api } from '@/lib/api';

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

function describeError(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Request failed';
  const b = body as {
    message?: string | string[];
    reason?: string;
    issues?: Array<{ path: string; message: string }>;
  };
  if (Array.isArray(b.message)) return b.message.join('; ');
  if (b.issues && b.issues.length > 0) return b.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
  return b.message ?? b.reason ?? 'Request failed';
}

export async function transitionOrderAction(
  orderNumber: string,
  input: TransitionOrderRequest,
): Promise<ActionResult> {
  const parsed = transitionOrderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/orders/${orderNumber}/transition`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function cancelOrderAction(
  orderNumber: string,
  input: CancelOrderRequest,
): Promise<ActionResult> {
  const parsed = cancelOrderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/orders/${orderNumber}/cancel`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function updateInternalNoteAction(
  orderNumber: string,
  input: UpdateInternalNoteRequest,
): Promise<ActionResult> {
  const parsed = updateInternalNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/orders/${orderNumber}/note`, { method: 'PATCH', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/orders/${orderNumber}`);
  return { ok: true };
}

export async function requestRefundAction(
  orderNumber: string,
  input: CreateRefundRequest,
): Promise<ActionResult> {
  const parsed = createRefundRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api('/refunds', { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath('/orders/refunds');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function approveRefundAction(
  refundId: string,
  orderNumber: string,
): Promise<ActionResult> {
  const res = await api(`/refunds/${refundId}/approve`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath('/orders/refunds');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function rejectRefundAction(
  refundId: string,
  orderNumber: string,
  input: RejectRefundRequest,
): Promise<ActionResult> {
  const parsed = rejectRefundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api(`/refunds/${refundId}/reject`, { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/orders/${orderNumber}`);
  revalidatePath('/orders/refunds');
  return { ok: true };
}
