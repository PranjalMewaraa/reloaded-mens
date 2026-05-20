// SSR helpers for customer-authenticated reads. Forwards the customer_access
// cookie from the incoming request so Server Components can render personalised
// pages (/account, /account/orders) without a client round-trip.

import { cookies } from 'next/headers';
import type { CustomerOrderListResponse, CustomerProfile, OrderSnapshot } from '@repo/types';
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

// Lookup of a single order scoped to the logged-in customer. The api endpoint
// (customer-orders/:orderNumber) verifies `order.customerId === req.customer.id`
// internally — if the order isn't owned by this customer (or the customer isn't
// signed in), we get a 404 and return null.
//
// Used by the tracking page so logged-in customers can hit /track/<orderNumber>
// directly (no `?t=` token needed) — we pull the trackingToken off the order
// row server-side and continue with the normal token-based tracking fetch.
export async function getCustomerOrder(orderNumber: string): Promise<OrderSnapshot | null> {
  const res = await authedFetch(`/customer-orders/${encodeURIComponent(orderNumber)}`);
  if (!res.ok) return null;
  return (await res.json()) as OrderSnapshot;
}
