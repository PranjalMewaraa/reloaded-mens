'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { api } from '@/lib/api';

export interface UpiSlot {
  upiId: string;
  label: string;
}

const upiSlotSchema = z.object({
  upiId: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
});

const savePosUpiSchema = z.object({
  slots: z.array(upiSlotSchema).max(10),
  activeIndex: z.number().int().min(0),
});

export async function savePosUpiAction(slots: UpiSlot[], activeIndex: number) {
  const parsed = savePosUpiSchema.safeParse({ slots, activeIndex });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await api('/admin/settings/pos-upi', {
    method: 'PATCH',
    body: parsed.data,
    forwardCookies: true,
  });
  if (!res.ok) return { ok: false, error: 'Failed to save UPI settings' };
  revalidatePath('/settings');
  return { ok: true };
}
