// Set-Cookie header parsing shared by middleware (edge) and server code.

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

export function parseSetCookie(header: string): ParsedCookie | null {
  const parts = header.split(';').map((p) => p.trim());
  const [first] = parts;
  if (!first) return null;
  const eq = first.indexOf('=');
  if (eq === -1) return null;
  const out: ParsedCookie = { name: first.slice(0, eq).trim(), value: first.slice(eq + 1).trim() };

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

export function isClearing(c: ParsedCookie): boolean {
  return c.maxAge === 0 || (c.expires !== undefined && c.expires.getTime() < Date.now());
}

// Path is forced to '/' because the API's paths (e.g. /api/v1/auth/refresh) don't
// exist on the admin origin. Domain is forwarded (e.g. `.reloadedmens.in`) because
// upload, reports export and shipping labels call api.* directly from the browser.
export function toMirroredCookie(c: ParsedCookie) {
  if (isClearing(c)) {
    return { name: c.name, value: '', path: '/', domain: c.domain, maxAge: 0 };
  }
  return {
    name: c.name,
    value: c.value,
    path: '/',
    domain: c.domain,
    maxAge: c.maxAge,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  };
}

export function readSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const raw = headers.get('set-cookie');
  return raw ? raw.split(/,(?=\s*[^;,=\s]+=)/) : [];
}
