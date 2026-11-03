import { NextRequest, NextResponse } from 'next/server';
import { totpVerifyRequestSchema } from '@repo/types';
import { api } from '@/lib/api';
import { mirrorCookiesToResponse } from '@/lib/cookies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = totpVerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Enter the 6-digit code from your authenticator app.' },
      { status: 400 },
    );
  }

  const res = await api<{ ok: boolean }>('/auth/totp/verify', {
    method: 'POST',
    body: parsed.data,
  });

  if (res.status === 401) {
    return NextResponse.json({ ok: false, error: 'Invalid code' }, { status: 401 });
  }
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: 'Verification failed. Please try again.' }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  mirrorCookiesToResponse(res.setCookies, response);
  return response;
}
