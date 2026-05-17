// Stable per-browser identifier. Sprint 8 (customer login) + Sprint 13 (abandoned-cart)
// link orders back to a device id when no customer is logged in — generated once on
// first visit and reused forever.

import { v4 as uuid } from 'uuid';

const STORAGE_KEY = 'reloaded.device.v1';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const next = uuid();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    // localStorage disabled — fall back to a per-session UUID so the order still has a key.
    return uuid();
  }
}
