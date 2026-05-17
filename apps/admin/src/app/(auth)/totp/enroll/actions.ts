'use server';

import { totpVerifyRequestSchema } from '@repo/types';
import { api } from '@/lib/api';
import { mirrorSetCookies } from '@/lib/cookies';

export type TotpSetupResult =
  | { ok: true; qrDataUrl: string; secretBase32: string }
  | { ok: false; error: string };

export async function totpSetupAction(): Promise<TotpSetupResult> {
  const res = await api<{ qrDataUrl: string; otpauthUri: string; secretBase32: string }>(
    '/auth/totp/setup',
    { method: 'POST' },
  );
  await mirrorSetCookies(res.setCookies);

  if (res.status === 401) {
    return { ok: false, error: 'Session expired. Please sign in again.' };
  }
  if (!res.ok || !res.body) {
    return { ok: false, error: 'Could not start TOTP setup' };
  }
  return { ok: true, qrDataUrl: res.body.qrDataUrl, secretBase32: res.body.secretBase32 };
}

export type TotpEnrollResult = { ok: true } | { ok: false; error: string };

export async function totpEnrollAction(input: { code: string }): Promise<TotpEnrollResult> {
  const parsed = totpVerifyRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Enter the 6-digit code from your authenticator app.' };
  }
  const res = await api<{ ok: boolean }>('/auth/totp/enroll', {
    method: 'POST',
    body: parsed.data,
  });
  await mirrorSetCookies(res.setCookies);

  if (res.status === 401) return { ok: false, error: 'Invalid code' };
  if (!res.ok) return { ok: false, error: 'Verification failed. Please try again.' };
  return { ok: true };
}
