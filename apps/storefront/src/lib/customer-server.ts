// SSR helpers for customer-authenticated reads. Forwards the customer_access
// cookie from the incoming request so Server Components can render personalised
// pages (/account, /account/orders) without a client round-trip.

import { cookies } from 'next/headers';
import type { CustomerOrderListResponse, CustomerProfile, OrderSnapshot } from '@repo/types';
import { API_BASE } from './env';

async function authedFetch(path: string): Promise<Response | null> {
  try {
    const all = (await cookies()).getAll();
    const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join('; ');
    return await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    });
  } catch {
    return null;
  }
}

export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const res = await authedFetch('/customer-auth/me');
  if (!res || res.status === 401 || !res.ok) return null;
  try {
    const data = (await res.json()) as { customer: CustomerProfile };
    return data.customer;
  } catch {
    return null;
  }
}

export async function getCustomerOrders(page = 1): Promise<CustomerOrderListResponse | null> {
  const res = await authedFetch(`/customer-orders?page=${page}`);
  if (!res || res.status === 401 || !res.ok) return null;
  try {
    return (await res.json()) as CustomerOrderListResponse;
  } catch {
    return null;
  }
}

export async function getCustomerOrder(orderNumber: string): Promise<OrderSnapshot | null> {
  const res = await authedFetch(`/customer-orders/${encodeURIComponent(orderNumber)}`);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as OrderSnapshot;
  } catch {
    return null;
  }
}
