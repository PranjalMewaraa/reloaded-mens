'use server';

import { revalidatePath } from 'next/cache';
import {
  updateLeadSchema,
  type LeadSummary,
  type UpdateLeadRequest,
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

function bust(id?: string) {
  revalidatePath('/leads');
  revalidatePath('/dashboard');
  if (id) revalidatePath(`/leads/${id}`);
}

export async function updateLeadAction(
  id: string,
  input: UpdateLeadRequest,
): Promise<ActionResult<LeadSummary>> {
  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api<LeadSummary>(`/admin-leads/${id}`, { method: 'PATCH', body: parsed.data });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true, data: res.body };
}

export async function deleteLeadAction(id: string): Promise<ActionResult> {
  const res = await api(`/admin-leads/${id}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust();
  return { ok: true };
}
