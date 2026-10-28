'use server';

import { revalidatePath } from 'next/cache';
import {
  createProductSchema,
  type CreateProductInput,
} from '@repo/types';
import { z } from 'zod';
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
  const failed: string[] = [];
  for (const id of ids) {
    const res = await api(`/products/${id}`, { method: 'PATCH', body: { isActive } });
    if (!res.ok) failed.push(id);
  }
  revalidatePath('/products');
  if (failed.length > 0) {
    return { ok: false, error: `${failed.length} of ${ids.length} product(s) could not be updated` };
  }
  return { ok: true };
}

export async function bulkDeleteAction(ids: string[]): Promise<ActionResult> {
  const failed: string[] = [];
  for (const id of ids) {
    const res = await api(`/products/${id}`, { method: 'DELETE' });
    if (!res.ok) failed.push(id);
  }
  revalidatePath('/products');
  if (failed.length > 0) {
    return { ok: false, error: `${failed.length} of ${ids.length} product(s) could not be deleted` };
  }
  return { ok: true };
}

const bulkEditSchema = z.object({
  ids: z.array(z.string()).min(1),
  patch: z.object({
    availabilityFlag: z.enum(['online_shippable', 'in_store_only', 'both']).optional(),
    gstRatePercent: z.number().int().min(0).max(50).optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.string()).optional(),
  }),
});

export type BulkEditInput = z.infer<typeof bulkEditSchema>;

export async function bulkEditAction(input: BulkEditInput): Promise<ActionResult> {
  const parsed = bulkEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const { ids, patch } = parsed.data;
  const { categoryIds, ...productPatch } = patch;
  const failed: string[] = [];

  for (const id of ids) {
    // Apply scalar field changes (availability, gst, isActive) in one PATCH.
    if (Object.keys(productPatch).length > 0) {
      const res = await api(`/products/${id}`, { method: 'PATCH', body: productPatch });
      if (!res.ok) { failed.push(id); continue; }
    }
    // Replace category assignments if caller provided them.
    if (categoryIds !== undefined) {
      const res = await api(`/products/${id}/categories`, {
        method: 'PUT',
        body: { categoryIds },
      });
      if (!res.ok) failed.push(id);
    }
  }

  revalidatePath('/products');
  if (failed.length > 0) {
    return { ok: false, error: `${failed.length} of ${ids.length} product(s) could not be updated` };
  }
  return { ok: true };
}
