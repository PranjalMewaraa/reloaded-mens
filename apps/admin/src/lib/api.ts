// Tiny fetch wrapper. Server-side: forwards request cookies to the API and parses Set-Cookie back
// so server actions can establish/clear sessions. Client-side: relies on the browser to send cookies.

import { cookies } from 'next/headers';
import { API_BASE } from './env';

export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  body: T | undefined;
  setCookies: string[];
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  // When called from a Server Component / Server Action, set forwardCookies=true.
  // When called from the browser via 'use server' or a fetch in client code, it can be omitted (browser handles cookies).
  forwardCookies?: boolean;
  // When true, body is treated as multipart FormData. The wrapper sets neither
  // content-type nor JSON-stringifies; fetch handles the boundary itself.
  multipart?: boolean;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, forwardCookies = true, multipart = false } = options;

  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (body !== undefined && !multipart) headers['content-type'] = 'application/json';

  if (forwardCookies) {
    const all = (await cookies()).getAll();
    if (all.length > 0) {
      headers.cookie = all.map((c) => `${c.name}=${c.value}`).join('; ');
    }
  }

  // multipart: pass through FormData/Blob/etc. untouched. Otherwise JSON-stringify.
  let init: BodyInit | undefined;
  if (body !== undefined) {
    init = multipart ? (body as BodyInit) : JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: init,
    cache: 'no-store',
    redirect: 'manual',
  });

  // Node's fetch exposes Set-Cookie via getSetCookie() (undici).
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(res.headers) : [];

  let parsed: T | undefined;
  const text = await res.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      parsed = text as unknown as T;
    }
  }

  return { status: res.status, ok: res.ok, body: parsed, setCookies };
}
