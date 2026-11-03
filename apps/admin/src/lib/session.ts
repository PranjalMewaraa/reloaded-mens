// Server-side helpers for reading the current admin session.

import { api } from './api';

export interface AdminSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Returns the current admin user, or null only when the API says the session
// is invalid (401/403). Rate limits, 5xx and network errors throw instead:
// redirecting to /login for those traps a validly-signed-in user in a loop.
export async function getCurrentUser(): Promise<AdminSessionUser | null> {
  const res = await api<AdminSessionUser>('/auth/me');
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok || !res.body) throw new Error(`Session check failed (HTTP ${res.status})`);
  return res.body;
}
