import { NextRequest, NextResponse } from 'next/server';
import { AUTH_STAGE, loginRequestSchema } from '@repo/types';
import { api } from '@/lib/api';
import { mirrorSetCookies } from '@/lib/cookies';

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

  await mirrorSetCookies(res.setCookies);

  const stage = res.body.stage;
  if (stage === AUTH_STAGE.COMPLETE) {
    return NextResponse.json({ ok: true, nextStage: 'complete' });
  }
  if (stage === AUTH_STAGE.TOTP_REQUIRED) {
    return NextResponse.json({ ok: true, nextStage: 'totp' });
  }
  if (stage === AUTH_STAGE.TOTP_ENROLLMENT_REQUIRED) {
    return NextResponse.json({ ok: true, nextStage: 'totp_enrollment' });
  }
  return NextResponse.json({ ok: false, error: 'Unexpected server response' }, { status: 502 });
}
