'use server';

import {
  searchProducts as _searchProducts,
  createPosOrder as _createPosOrder,
  getPosSettings as _getPosSettings,
  applyCoupon as _applyCoupon,
  switchUpiActive as _switchUpiActive,
  type PosProduct,
  type PosSettings,
  type CreatePosOrderRequest,
  type CreatePosOrderResponse,
} from '@/lib/api';

// Re-export types so page.tsx only needs one import source.
export type { PosProduct, PosSettings, UpiSlot, CreatePosOrderRequest, CreatePosOrderResponse } from '@/lib/api';
export type { ProductVariant } from '@/lib/api';

// These run server-side, so BILLING_API_TOKEN is available (not NEXT_PUBLIC_).
export async function searchProducts(q: string): Promise<PosProduct[]> {
  try {
    return await _searchProducts(q);
  } catch {
    return [];
  }
}

export async function getPosSettings(): Promise<PosSettings> {
  try {
    return await _getPosSettings();
  } catch {
    return { upiId: '', upiDisplayName: 'Reloaded Mens', upiSlots: [], upiActiveIndex: 0 };
  }
}

export async function createPosOrder(
  body: CreatePosOrderRequest,
): Promise<CreatePosOrderResponse> {
  return _createPosOrder(body);
}

export async function applyCoupon(
  code: string,
  totalPaisa: number,
): Promise<{ discountPaisa: number; message?: string } | null> {
  try {
    return await _applyCoupon(code, totalPaisa);
  } catch {
    return null;
  }
}

export async function switchUpiActive(index: number): Promise<void> {
  try {
    await _switchUpiActive(index);
  } catch { /* ignore */ }
}
