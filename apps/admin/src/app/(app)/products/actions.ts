'use server';

import { revalidatePath } from 'next/cache';
import {
  createProductSchema,
  type CreateProductInput,
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
  if (b.issues && b.issues.length > 0)
    return b.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
  return b.message ?? b.reason ?? 'Request failed';
}

export async function createProductAction(
  input: CreateProductInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api<{ id: string }>('/products', { method: 'POST', body: parsed.data });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  revalidatePath('/products');
  return { ok: true, data: { id: res.body.id } };
}

export async function bulkSetActiveAction(
  ids: string[],
  isActive: boolean,
): Promise<ActionResult> {
  for (const id of ids) {
    const res = await api(`/products/${id}`, { method: 'PATCH', body: { isActive } });
    if (!res.ok) return { ok: false, error: describeError(res.body) };
  }
  revalidatePath('/products');
  return { ok: true };
}

export async function bulkDeleteAction(ids: string[]): Promise<ActionResult> {
  for (const id of ids) {
    const res = await api(`/products/${id}`, { method: 'DELETE' });
    if (!res.ok) return { ok: false, error: describeError(res.body) };
  }
  revalidatePath('/products');
  return { ok: true };
}
