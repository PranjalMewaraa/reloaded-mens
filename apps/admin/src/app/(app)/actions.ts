'use server';

import { api } from '@/lib/api';
import { mirrorSetCookies } from '@/lib/cookies';

export async function logoutAction(): Promise<void> {
  const res = await api<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  await mirrorSetCookies(res.setCookies);
}
