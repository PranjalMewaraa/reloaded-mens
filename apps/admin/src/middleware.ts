import { NextResponse, type NextRequest } from 'next/server';
import { parseSetCookie, readSetCookies, toMirroredCookie } from '@/lib/set-cookie';

// Presence-only check on the access_token cookie. Validity is enforced
// server-side by the (app) layout calling /auth/me.
//
// When the short-lived access_token is missing or about to expire but a
// refresh_token exists, renew it here so a signed-in admin isn't bounced to
// /login every time the access token lapses.

const PUBLIC_PATHS = ['/login', '/totp', '/api/auth', '/favicon.ico', '/robots.txt'];
const REFRESH_LEEWAY_SECONDS = 60;

function apiBase(): string {
  const internal = process.env.ADMIN_INTERNAL_API_URL;
  const pub = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:4000';
  return `${internal || pub}/api/v1`;
}

// Reads exp without verifying — only used to decide whether to refresh early.
function secondsUntilExpiry(jwt: string): number | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp - Math.floor(Date.now() / 1000) : null;
  } catch {
    return null;
  }
}

async function tryRefresh(refreshToken: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${apiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `refresh_token=${refreshToken}`, accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return readSetCookies(res.headers);
  } catch {
    return null;
  }
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;
  const refreshToken = req.cookies.get('refresh_token')?.value;

  const remaining = accessToken ? secondsUntilExpiry(accessToken) : null;
  const needsRefresh = !accessToken || (remaining !== null && remaining < REFRESH_LEEWAY_SECONDS);

  if (!needsRefresh) return NextResponse.next();
  if (!refreshToken) return accessToken ? NextResponse.next() : redirectToLogin(req);

  const setCookies = await tryRefresh(refreshToken);
  if (!setCookies) return accessToken ? NextResponse.next() : redirectToLogin(req);

  const mirrored = setCookies
    .map(parseSetCookie)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map(toMirroredCookie);

  // Make the new token visible to this request's server components, not just the next one.
  for (const c of mirrored) {
    if (c.value) req.cookies.set(c.name, c.value);
  }
  const response = NextResponse.next({ request: { headers: req.headers } });
  for (const c of mirrored) response.cookies.set(c);
  return response;
}

export const config = {
  // Run middleware for everything except static assets and the Next.js internals.
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
