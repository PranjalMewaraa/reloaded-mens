'use server';

import { revalidatePath } from 'next/cache';
import { rejectReviewSchema, type AdminReviewSummary } from '@repo/types';
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
  revalidatePath('/reviews');
  revalidatePath('/dashboard');
}

export async function approveReviewAction(id: string): Promise<ActionResult<AdminReviewSummary>> {
  const res = await api<AdminReviewSummary>(`/admin-reviews/${id}/approve`, { method: 'POST' });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust();
  return { ok: true, data: res.body };
}

export async function rejectReviewAction(
  id: string,
  reason: string,
): Promise<ActionResult<AdminReviewSummary>> {
  const parsed = rejectReviewSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api<AdminReviewSummary>(`/admin-reviews/${id}/reject`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust();
  return { ok: true, data: res.body };
}
