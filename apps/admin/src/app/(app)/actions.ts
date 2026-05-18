'use server';

import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { mirrorSetCookies } from '@/lib/cookies';

// Cookie names mirror apps/api/src/auth/auth.service.ts constants. Duplicated
// here because pulling them through the workspace would require turning auth
// into a published surface — overkill for two string literals.
const SESSION_COOKIE_NAMES = ['access_token', 'refresh_token', 'stage_token'];

export async function logoutAction(): Promise<void> {
  // Best-effort api call — wrapped so a transient API outage doesn't strand
  // the user on the dashboard. We clear cookies locally regardless of the
  // server response.
  try {
    const res = await api<{ ok: boolean }>('/auth/logout', { method: 'POST' });
    await mirrorSetCookies(res.setCookies);
  } catch {
    // Network failure or non-2xx — fall through to the local clear below.
  }

  // Belt-and-suspenders: ensure the cookies are deleted even if the api's
  // Set-Cookie didn't make it back (e.g. api down, mirror parsed the domain
  // wrong, etc). next/headers cookies().delete() removes by name from the
  // outgoing response — the browser then drops them on receipt.
  const jar = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    if (jar.has(name)) jar.delete(name);
  }
}
