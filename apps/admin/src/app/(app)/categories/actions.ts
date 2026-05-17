'use server';

import { revalidatePath } from 'next/cache';
import {
  createCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type ReorderCategoriesInput,
  type UpdateCategoryInput,
} from '@repo/types';
import { api } from '@/lib/api';

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

function describeError(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Request failed';
  const b = body as { message?: string | string[]; reason?: string; issues?: Array<{ path: string; message: string }> };
  if (Array.isArray(b.message)) return b.message.join('; ');
  if (b.issues && b.issues.length > 0) return b.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
  return b.message ?? b.reason ?? 'Request failed';
}

export async function createCategoryAction(input: CreateCategoryInput): Promise<ActionResult> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api('/categories', { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath('/categories');
  return { ok: true };
}

export async function updateCategoryAction(
  id: string,
  input: UpdateCategoryInput,
): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api(`/categories/${id}`, { method: 'PATCH', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath('/categories');
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const res = await api(`/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath('/categories');
  return { ok: true };
}

export async function reorderCategoriesAction(
  input: ReorderCategoriesInput,
): Promise<ActionResult> {
  const parsed = reorderCategoriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api('/categories/reorder', { method: 'POST', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath('/categories');
  return { ok: true };
}
