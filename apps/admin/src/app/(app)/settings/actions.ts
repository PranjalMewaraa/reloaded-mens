'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export interface UpiSlot {
  upiId: string;
  label: string;
}

export async function savePosUpiAction(slots: UpiSlot[], activeIndex: number) {
  const res = await api('/admin/settings/pos-upi', {
    method: 'PATCH',
    body: { slots, activeIndex },
    forwardCookies: true,
  });
  if (!res.ok) return { ok: false, error: 'Failed to save UPI settings' };
  revalidatePath('/settings');
  return { ok: true };
}
