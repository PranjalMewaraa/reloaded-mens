'use server';

import { revalidatePath } from 'next/cache';
import {
  createPromotionSchema,
  generateCouponsSchema,
  singleCouponCreateSchema,
  updatePromotionSchema,
  type BulkCouponGenerateResponse,
  type CouponSummary,
  type CreatePromotionRequest,
  type GenerateCouponsRequest,
  type PromotionDetail,
  type SingleCouponCreate,
  type UpdatePromotionRequest,
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
  revalidatePath('/promotions');
  revalidatePath('/dashboard');
  if (id) revalidatePath(`/promotions/${id}`);
}

export async function createPromotionAction(
  input: CreatePromotionRequest,
): Promise<ActionResult<PromotionDetail>> {
  const parsed = createPromotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api<PromotionDetail>('/admin-promotions', { method: 'POST', body: parsed.data });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust();
  return { ok: true, data: res.body };
}

export async function updatePromotionAction(
  id: string,
  input: UpdatePromotionRequest,
): Promise<ActionResult<PromotionDetail>> {
  const parsed = updatePromotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api<PromotionDetail>(`/admin-promotions/${id}`, { method: 'PATCH', body: parsed.data });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true, data: res.body };
}

export async function deletePromotionAction(id: string): Promise<ActionResult> {
  const res = await api(`/admin-promotions/${id}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(id);
  return { ok: true };
}

export async function createCouponAction(
  promotionId: string,
  input: SingleCouponCreate,
): Promise<ActionResult<CouponSummary>> {
  const parsed = singleCouponCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api<CouponSummary>(`/admin-promotions/${promotionId}/coupons`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust(promotionId);
  return { ok: true, data: res.body };
}

export async function bulkGenerateCouponsAction(
  promotionId: string,
  input: GenerateCouponsRequest,
): Promise<ActionResult<BulkCouponGenerateResponse>> {
  const parsed = generateCouponsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const res = await api<BulkCouponGenerateResponse>(`/admin-promotions/${promotionId}/coupons/bulk`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  bust(promotionId);
  return { ok: true, data: res.body };
}

export async function deactivateCouponAction(
  promotionId: string,
  couponId: string,
): Promise<ActionResult> {
  const res = await api(`/admin-promotions/coupons/${couponId}/deactivate`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  bust(promotionId);
  return { ok: true };
}
