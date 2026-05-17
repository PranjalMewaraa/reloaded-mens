'use client';

// Client-side wrappers around /customer-auth/* + /customer-orders/* endpoints.
// All requests use `credentials: 'include'` so the customer_access cookie travels
// with each call.

import type {
  CustomerOrderListResponse,
  CustomerProfile,
  RequestCustomerOtpRequest,
  RequestCustomerOtpResponse,
  UpdateCustomerProfileRequest,
  VerifyCustomerOtpRequest,
  VerifyCustomerOtpResponse,
} from '@repo/types';
import { env } from './env';

const BASE = `${env.NEXT_PUBLIC_API_URL}/api/v1`;

interface ApiErrorBody {
  message?: string | string[];
  reason?: string;
}

export class CustomerApiError extends Error {
  public readonly status: number;
  public readonly body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(extract(body));
    this.status = status;
    this.body = body;
  }
}

function extract(b: ApiErrorBody): string {
  if (Array.isArray(b.message)) return b.message.join('; ');
  return b.message ?? b.reason ?? 'Request failed';
}

async function readOrThrow<T>(res: Response): Promise<T> {
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
    throw new CustomerApiError(res.status, (parsed as ApiErrorBody) ?? {});
  }
  return parsed as T;
}

export async function requestOtp(input: RequestCustomerOtpRequest): Promise<RequestCustomerOtpResponse> {
  const res = await fetch(`${BASE}/customer-auth/otp/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });
  return readOrThrow<RequestCustomerOtpResponse>(res);
}

export async function verifyOtp(input: VerifyCustomerOtpRequest): Promise<VerifyCustomerOtpResponse> {
  const res = await fetch(`${BASE}/customer-auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });
  return readOrThrow<VerifyCustomerOtpResponse>(res);
}

export async function fetchMe(): Promise<CustomerProfile | null> {
  const res = await fetch(`${BASE}/customer-auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  const body = await readOrThrow<{ customer: CustomerProfile }>(res);
  return body.customer;
}

export async function updateMe(input: UpdateCustomerProfileRequest): Promise<CustomerProfile> {
  const res = await fetch(`${BASE}/customer-auth/me`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });
  const body = await readOrThrow<{ customer: CustomerProfile }>(res);
  return body.customer;
}

export async function logoutCustomer(): Promise<void> {
  await fetch(`${BASE}/customer-auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchMyOrders(page = 1): Promise<CustomerOrderListResponse> {
  const res = await fetch(`${BASE}/customer-orders?page=${page}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  return readOrThrow<CustomerOrderListResponse>(res);
}
