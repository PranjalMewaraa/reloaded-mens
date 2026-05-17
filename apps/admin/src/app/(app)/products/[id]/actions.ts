'use server';

import { revalidatePath } from 'next/cache';
import {
  matrixCreateSchema,
  setProductCategoriesSchema,
  stockAdjustSchema,
  updateProductSchema,
  updateVariantSchema,
  type MatrixCreateInput,
  type SetProductCategoriesInput,
  type StockAdjustInput,
  type UpdateProductInput,
  type UpdateVariantInput,
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

export async function updateProductAction(
  id: string,
  input: UpdateProductInput,
): Promise<ActionResult> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api(`/products/${id}`, { method: 'PATCH', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/products/${id}`);
  revalidatePath('/products');
  return { ok: true };
}

export async function setProductCategoriesAction(
  id: string,
  input: SetProductCategoriesInput,
): Promise<ActionResult> {
  const parsed = setProductCategoriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api(`/products/${id}/categories`, {
    method: 'PUT',
    body: parsed.data,
  });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/products/${id}`);
  return { ok: true };
}

export async function createVariantMatrixAction(
  productId: string,
  input: MatrixCreateInput,
): Promise<ActionResult> {
  const parsed = matrixCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api(`/products/${productId}/variants/matrix`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function updateVariantAction(
  variantId: string,
  productId: string,
  input: UpdateVariantInput,
): Promise<ActionResult> {
  const parsed = updateVariantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api(`/variants/${variantId}`, { method: 'PATCH', body: parsed.data });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function deleteVariantAction(
  variantId: string,
  productId: string,
): Promise<ActionResult> {
  const res = await api(`/variants/${variantId}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function adjustVariantStockAction(
  variantId: string,
  productId: string | null,
  input: StockAdjustInput,
): Promise<ActionResult> {
  const parsed = stockAdjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api(`/variants/${variantId}/stock-adjust`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  if (productId) revalidatePath(`/products/${productId}`);
  revalidatePath('/inventory');
  return { ok: true };
}
