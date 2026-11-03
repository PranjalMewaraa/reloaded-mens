import { NextRequest, NextResponse } from 'next/server';
import { AUTH_STAGE, loginRequestSchema } from '@repo/types';
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

  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid email and password (min 8 chars).' },
      { status: 400 },
    );
  }

  const res = await api<{ stage: string }>('/auth/login', {
    method: 'POST',
    body: parsed.data,
  });

  if (res.status === 401) {
    return NextResponse.json({ ok: false, error: 'Invalid email or password' }, { status: 401 });
  }
  if (!res.ok || !res.body) {
    return NextResponse.json({ ok: false, error: 'Login failed. Please try again.' }, { status: 502 });
  }

  const stage = res.body.stage;
  let payload: { ok: boolean; nextStage?: string; error?: string };
  if (stage === AUTH_STAGE.COMPLETE) {
    payload = { ok: true, nextStage: 'complete' };
  } else if (stage === AUTH_STAGE.TOTP_REQUIRED) {
    payload = { ok: true, nextStage: 'totp' };
  } else if (stage === AUTH_STAGE.TOTP_ENROLLMENT_REQUIRED) {
    payload = { ok: true, nextStage: 'totp_enrollment' };
  } else {
    return NextResponse.json({ ok: false, error: 'Unexpected server response' }, { status: 502 });
  }

  const response = NextResponse.json(payload);
  mirrorCookiesToResponse(res.setCookies, response);
  return response;
}
