// Mirror Set-Cookie strings from the API onto the admin's own origin.
// Why: the admin acts as a BFF — cookies issued by api.reloadedmens.in would not be
// reachable by Next.js Server Components, so we re-issue them on the admin origin.
//
// Two variants:
//   mirrorCookiesToResponse — for Route Handlers (set on NextResponse directly)
//   mirrorSetCookies        — for Server Actions (use cookies() from next/headers)

import type { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export interface ParsedCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

function parseSetCookie(header: string): ParsedCookie | null {
  const parts = header.split(';').map((p) => p.trim());
  const [first] = parts;
  if (!first) return null;
  const eq = first.indexOf('=');
  if (eq === -1) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  const out: ParsedCookie = { name, value };

  for (const segment of parts.slice(1)) {
    const i = segment.indexOf('=');
    const key = (i === -1 ? segment : segment.slice(0, i)).trim().toLowerCase();
    const val = i === -1 ? '' : segment.slice(i + 1).trim();
    switch (key) {
      case 'path':
        out.path = val;
        break;
      case 'domain':
        out.domain = val;
        break;
      case 'max-age':
        out.maxAge = Number(val);
        break;
      case 'expires':
        out.expires = new Date(val);
        break;
      case 'httponly':
        out.httpOnly = true;
        break;
      case 'secure':
        out.secure = true;
        break;
      case 'samesite': {
        const lower = val.toLowerCase();
        if (lower === 'lax' || lower === 'strict' || lower === 'none') out.sameSite = lower;
        break;
      }
    }
  }
  return out;
}

// Set mirrored cookies directly on a NextResponse — the only reliable way in
// Route Handlers (cookies().set() only flushes in Server Actions).
export function mirrorCookiesToResponse(setCookies: string[], response: NextResponse): void {
  for (const raw of setCookies) {
    const parsed = parseSetCookie(raw);
    if (!parsed) continue;

    // A cleared cookie has Max-Age=0 (or expires in the past). Delete it.
    if (parsed.maxAge === 0 || (parsed.expires && parsed.expires.getTime() < Date.now())) {
      response.cookies.set({
        name: parsed.name,
        value: '',
        path: '/',
        domain: parsed.domain,
        maxAge: 0,
      });
      continue;
    }

    response.cookies.set({
      name: parsed.name,
      value: parsed.value,
      // Always path='/' — API paths like /api/v1/auth/refresh don't exist on
      // the admin origin, so the browser would never send the cookie otherwise.
      path: '/',
      // Drop the domain so the cookie is host-only for admin.reloadedmens.in.
      // Forwarding the API's domain (.reloadedmens.in) can silently fail if
      // the browser treats a cross-subdomain Set-Cookie as a security violation.
      domain: undefined,
      maxAge: parsed.maxAge,
      expires: parsed.expires,
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
    });
  }
}

// For Server Actions — cookies().set() works there but NOT in Route Handlers.
export async function mirrorSetCookies(setCookies: string[]): Promise<void> {
  if (setCookies.length === 0) return;
  const jar = await cookies();
  for (const raw of setCookies) {
    const parsed = parseSetCookie(raw);
    if (!parsed) continue;
    if (parsed.maxAge === 0 || (parsed.expires && parsed.expires.getTime() < Date.now())) {
      jar.set({ name: parsed.name, value: '', path: '/', domain: parsed.domain, maxAge: 0 });
      continue;
    }
    jar.set({
      name: parsed.name,
      value: parsed.value,
      path: '/',
      domain: undefined,
      maxAge: parsed.maxAge,
      expires: parsed.expires,
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
    });
  }
}
