// Mirror Set-Cookie strings from the API onto the Next.js response cookie jar.
// Why: the admin acts as a BFF — cookies issued by api.yourbrand.com would not be
// reachable by Server Components, so we re-issue them on the admin's own origin.

import { cookies } from 'next/headers';

interface ParsedCookie {
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

export async function mirrorSetCookies(setCookies: string[]): Promise<void> {
  if (setCookies.length === 0) return;
  const jar = await cookies();
  for (const raw of setCookies) {
    const parsed = parseSetCookie(raw);
    if (!parsed) continue;

    // A cleared cookie has Max-Age=0 (or in the past). Honor it by deleting.
    if (parsed.maxAge === 0 || (parsed.expires && parsed.expires.getTime() < Date.now())) {
      jar.set({
        name: parsed.name,
        value: '',
        path: parsed.path,
        // Match the original Domain so the browser clears the right cookie.
        // Skipping this leaves a zombie cookie on the parent domain.
        domain: parsed.domain,
        maxAge: 0,
      });
      continue;
    }

    jar.set({
      name: parsed.name,
      value: parsed.value,
      path: parsed.path,
      // Forward Domain (e.g. `.reloadedmens.in`) so the same cookie is valid
      // on every subdomain — required for client-side fetches from
      // admin.reloadedmens.in to api.reloadedmens.in to carry credentials.
      // Without this the mirrored cookie is host-only on admin.* and api.*
      // calls arrive without auth.
      domain: parsed.domain,
      maxAge: parsed.maxAge,
      expires: parsed.expires,
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
    });
  }
}
