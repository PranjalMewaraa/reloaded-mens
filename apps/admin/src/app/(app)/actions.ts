'use server';

import { cookies, headers } from 'next/headers';
import { api } from '@/lib/api';
import { mirrorSetCookies } from '@/lib/cookies';

// Cookie names mirror apps/api/src/auth/auth.service.ts constants. Duplicated
// here because pulling them through the workspace would require turning auth
// into a published surface — overkill for two string literals.
const SESSION_COOKIE_NAMES = ['access_token', 'refresh_token', 'stage_token'];

// For host = "admin.reloadedmens.in" returns ".reloadedmens.in". Returns
// undefined for "localhost"/single-label hosts so dev cookies stay host-only.
//
// Browsers index the cookie jar by (name, domain, path). To delete a cookie
// you must emit a Set-Cookie that matches its Domain attribute exactly — a
// host-only Set-Cookie won't touch a cookie whose Domain is `.reloadedmens.in`,
// and vice versa. The api issues cookies with Domain=COOKIE_DOMAIN in prod,
// so we must mirror that here when clearing.
async function deriveParentDomain(): Promise<string | undefined> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(':')[0];
  const parts = host.split('.');
  if (parts.length < 3) return undefined;
  return '.' + parts.slice(1).join('.');
}

export async function logoutAction(): Promise<void> {
  // Best-effort api call — wrapped so a transient API outage doesn't strand
  // the user on the dashboard. We clear cookies locally regardless of the
  // server response.
  try {
    const res = await api<{ ok: boolean }>('/auth/logout', { method: 'POST' });
    await mirrorSetCookies(res.setCookies);
  } catch {
    // Network failure or non-2xx — fall through to the local clear below.
    console.log('logout failed, clearing cookies locally anyway');
  }

  // Belt-and-suspenders: emit Set-Cookie clears for BOTH scopes a session
  // cookie might be stored under — host-only and parent-domain. Without the
  // parent-domain clear, cookies set by the api with Domain=.reloadedmens.in
  // (production posture) survive logout because the host-only clear doesn't
  // match the cookie's Domain attribute.
  const jar = await cookies();
  const parentDomain = await deriveParentDomain();
  for (const name of SESSION_COOKIE_NAMES) {
    // Host-only clear (covers local dev + any cookie issued without Domain).
    jar.set({ name, value: '', path: '/', maxAge: 0 });
    // Parent-domain clear (covers the production cross-subdomain cookie).
    if (parentDomain) {
      jar.set({ name, value: '', path: '/', domain: parentDomain, maxAge: 0 });
    }
  }
}
