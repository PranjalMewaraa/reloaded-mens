// Mirror Set-Cookie strings from the API onto the admin's own origin.
// Why: the admin acts as a BFF — cookies issued by api.reloadedmens.in would not be
// reachable by Next.js Server Components, so we re-issue them on the admin origin.

import type { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSetCookie, toMirroredCookie } from './set-cookie';

export function mirrorCookiesToResponse(setCookies: string[], response: NextResponse): void {
  for (const raw of setCookies) {
    const parsed = parseSetCookie(raw);
    if (parsed) response.cookies.set(toMirroredCookie(parsed));
  }
}

export async function mirrorSetCookies(setCookies: string[]): Promise<void> {
  if (setCookies.length === 0) return;
  const jar = await cookies();
  for (const raw of setCookies) {
    const parsed = parseSetCookie(raw);
    if (parsed) jar.set(toMirroredCookie(parsed));
  }
}
