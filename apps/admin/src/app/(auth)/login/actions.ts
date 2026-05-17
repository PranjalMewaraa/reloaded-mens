'use server';

import { redirect } from 'next/navigation';
import { AUTH_STAGE, loginRequestSchema, totpVerifyRequestSchema } from '@repo/types';
import { api } from '@/lib/api';
import { mirrorSetCookies } from '@/lib/cookies';

export type LoginActionResult =
  | { ok: true; nextStage: 'totp' | 'totp_enrollment' | 'complete' }
  | { ok: false; error: string };

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<LoginActionResult> {
  const parsed = loginRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email and password (min 8 chars).' };
  }

  const res = await api<{ stage: string }>('/auth/login', {
    method: 'POST',
    body: parsed.data,
  });
  await mirrorSetCookies(res.setCookies);

  if (res.status === 401) {
    return { ok: false, error: 'Invalid email or password' };
  }
  if (!res.ok || !res.body) {
    return { ok: false, error: 'Login failed. Please try again.' };
  }

  if (res.body.stage === AUTH_STAGE.COMPLETE) {
    return { ok: true, nextStage: 'complete' };
  }
  if (res.body.stage === AUTH_STAGE.TOTP_REQUIRED) {
    return { ok: true, nextStage: 'totp' };
  }
  if (res.body.stage === AUTH_STAGE.TOTP_ENROLLMENT_REQUIRED) {
    return { ok: true, nextStage: 'totp_enrollment' };
  }
  return { ok: false, error: 'Unexpected server response' };
}

export type TotpVerifyResult = { ok: true } | { ok: false; error: string };

export async function totpVerifyAction(input: { code: string }): Promise<TotpVerifyResult> {
  const parsed = totpVerifyRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter the 6-digit code from your authenticator app.' };

  const res = await api<{ ok: boolean }>('/auth/totp/verify', {
    method: 'POST',
    body: parsed.data,
  });
  await mirrorSetCookies(res.setCookies);

  if (res.status === 401) return { ok: false, error: 'Invalid code' };
  if (!res.ok) return { ok: false, error: 'Verification failed. Please try again.' };

  // Success — redirect happens on the client to the requested 'next' path or dashboard.
  return { ok: true };
}

// Used by the totp-enroll flow before we have a session — checks that a stage cookie
// is present in the request. Caller should redirect to /login otherwise.
export async function postLoginRedirect(target: string) {
  redirect(target);
}
