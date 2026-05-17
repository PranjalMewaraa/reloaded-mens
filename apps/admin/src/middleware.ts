import { NextResponse, type NextRequest } from 'next/server';

// Presence-only check on the access_token cookie. Validity is enforced
// server-side by the (app) layout calling /auth/me.
//
// Public paths: /login, /totp/*, /_next/*, /favicon, public assets.
// Everything else requires an access_token cookie or a stage_token (mid-flow).

const PUBLIC_PATHS = ['/login', '/totp', '/favicon.ico', '/robots.txt'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware for everything except static assets and the Next.js internals.
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
