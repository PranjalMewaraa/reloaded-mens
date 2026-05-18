'use server';

// Sprint 9 Phase 3a/3b — inventory-specific server actions:
//   - quickAdjustStockAction: signed-delta adjust for the inline +/- buttons
//     and the Undo flow. Wraps the same `/variants/:id/stock-adjust` route
//     used by the AdjustDrawer so the InventoryEvent audit trail is identical.
//   - loadMoreInventoryAction: pure server-side fetch of the next page,
//     used by the mobile infinite-scroll sentinel.
//
// We keep these out of `products/[id]/actions.ts` so the inventory page's
// router.refresh fan-out is scoped to /inventory (not the product editor).

import { revalidatePath } from 'next/cache';
import {
  INVENTORY_CHANGE_TYPE,
  inventoryListQuerySchema,
  type InventoryListQuery,
  type StockAdjustInput,
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

/**
 * Quick stock adjustment used by the inline +/- buttons and the Undo flow.
 * Pure delta + auto-picked changeType so the operator doesn't have to pick
 * a reason for a one-tap +1.
 */
export async function quickAdjustStockAction(
  variantId: string,
  delta: number,
  hint?: { changeType?: StockAdjustInput['changeType']; note?: string },
): Promise<ActionResult> {
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Delta must be a non-zero integer' };
  }
  const changeType =
    hint?.changeType ??
    (delta > 0 ? INVENTORY_CHANGE_TYPE.RESTOCK : INVENTORY_CHANGE_TYPE.CORRECTION);
  const payload: StockAdjustInput = {
    delta,
    changeType,
    note: hint?.note,
  };
  const res = await api(`/variants/${variantId}/stock-adjust`, {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) return { ok: false, error: describeError(res.body) };
  revalidatePath('/inventory');
  return { ok: true };
}

/**
 * Fetch one page of inventory for the mobile infinite-scroll. Re-uses the
 * existing inventoryListQuerySchema so the contract stays unified.
 */
interface InventoryListResponse {
  items: unknown[];
  page: number;
  limit: number;
  total: number;
  aggregates: { total: number; inStock: number; low: number; out: number };
}

export async function loadMoreInventoryAction(
  query: Partial<InventoryListQuery>,
): Promise<ActionResult<InventoryListResponse>> {
  const parsed = inventoryListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const params = new URLSearchParams();
  Object.entries(parsed.data).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    params.set(k, String(v));
  });
  const res = await api<InventoryListResponse>(`/variants?${params.toString()}`);
  if (!res.ok || !res.body) return { ok: false, error: describeError(res.body) };
  return { ok: true, data: res.body };
}
