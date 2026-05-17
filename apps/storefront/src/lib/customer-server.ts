// SSR helpers for customer-authenticated reads. Forwards the customer_access
// cookie from the incoming request so Server Components can render personalised
// pages (/account, /account/orders) without a client round-trip.

import { cookies } from 'next/headers';
import type { CustomerOrderListResponse, CustomerProfile } from '@repo/types';
import { API_BASE } from './env';

async function authedFetch(path: string): Promise<Response> {
  const all = (await cookies()).getAll();
  const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join('; ');
  return fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: 'no-store',
  });
}

export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const res = await authedFetch('/customer-auth/me');
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { customer: CustomerProfile };
  return data.customer;
}

export async function getCustomerOrders(page = 1): Promise<CustomerOrderListResponse | null> {
  const res = await authedFetch(`/customer-orders?page=${page}`);
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as CustomerOrderListResponse;
}
