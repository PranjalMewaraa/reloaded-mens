// Server-side helpers for reading the current admin session.

import { api } from './api';

export interface AdminSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Returns the current admin user if authenticated, else null.
// Calls /auth/me with cookies forwarded; treats 401 as "not authenticated".
export async function getCurrentUser(): Promise<AdminSessionUser | null> {
  const res = await api<AdminSessionUser>('/auth/me');
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok || !res.body) return null;
  return res.body;
}
