// Storefront fetch wrapper. Server Components call this at request time; the
// `cache: 'no-store'` policy matches admin's Sprint-2 pattern so updates show up
// without waiting on ISR revalidation. Once the storefront stabilises we'll swap
// individual endpoints over to `next: { revalidate: N }` for ISR.

import { API_BASE } from './env';

export interface ApiOk<T> {
  ok: true;
  status: number;
  body: T;
}
export interface ApiErr {
  ok: false;
  status: number;
  error: string;
}
export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  // ISR opt-in. Defaults to no-store (always fresh). Set to a number of seconds for ISR,
  // or 'force-cache' for static-at-build-time.
  revalidate?: number;
  cache?: 'no-store' | 'force-cache';
}

export async function publicApi<T>(path: string, options: FetchOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, revalidate, cache = 'no-store' } = options;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...(revalidate !== undefined
        ? { next: { revalidate } }
        : { cache }),
    });

    const text = await res.text();
    let parsed: unknown;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const message =
        typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : `Request failed (${res.status})`;
      return { ok: false, status: res.status, error: message };
    }

    return { ok: true, status: res.status, body: parsed as T };
  } catch (err) {
    return { ok: false, status: 0, error: (err as Error).message };
  }
}
