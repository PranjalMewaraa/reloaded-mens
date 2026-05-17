// Client-side wrappers around the public checkout endpoints. These run in the browser
// (not Server Components), so we use fetch directly with `credentials: 'include'` for
// future auth cookies. publicApi() in lib/api.ts is fine for SSR reads, but the
// idempotency-key header pattern + status polling is easier inline here.

import type {
  CartEvaluateRequest,
  CartEvaluateResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateReturnRequest,
  CustomerReturnSummary,
  OrderSnapshot,
  PaymentStatusResponse,
  ReturnEligibilityResponse,
  ReturnPhotoUploadResponse,
} from '@repo/types';
import { env } from './env';

const BASE = `${env.NEXT_PUBLIC_API_URL}/api/v1`;

export interface CheckoutErrorBody {
  reason?: string;
  message?: string | string[];
  variantId?: string;
  sku?: string;
  available?: number;
}

export class CheckoutError extends Error {
  public readonly status: number;
  public readonly body: CheckoutErrorBody;
  constructor(status: number, body: CheckoutErrorBody) {
    super(extractMessage(body));
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body: CheckoutErrorBody): string {
  if (Array.isArray(body.message)) return body.message.join('; ');
  return body.message ?? body.reason ?? 'Request failed';
}

async function readJsonOrThrow(res: Response): Promise<unknown> {
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    throw new CheckoutError(res.status, (parsed as CheckoutErrorBody) ?? {});
  }
  return parsed;
}

export async function evaluateCart(input: CartEvaluateRequest): Promise<CartEvaluateResponse> {
  const res = await fetch(`${BASE}/public/cart/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });
  return (await readJsonOrThrow(res)) as CartEvaluateResponse;
}

export async function createOrder(
  input: CreateOrderRequest,
  deviceId: string,
): Promise<CreateOrderResponse> {
  const res = await fetch(`${BASE}/public/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': input.idempotencyKey,
      ...(deviceId ? { 'x-device-id': deviceId } : {}),
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });
  return (await readJsonOrThrow(res)) as CreateOrderResponse;
}

export async function getOrder(orderNumber: string): Promise<OrderSnapshot> {
  const res = await fetch(`${BASE}/public/orders/${encodeURIComponent(orderNumber)}`, {
    cache: 'no-store',
  });
  return (await readJsonOrThrow(res)) as OrderSnapshot;
}

export async function pollPaymentSession(sessionId: string): Promise<PaymentStatusResponse> {
  const res = await fetch(
    `${BASE}/public/payments/sessions/${encodeURIComponent(sessionId)}`,
    { cache: 'no-store' },
  );
  return (await readJsonOrThrow(res)) as PaymentStatusResponse;
}

// ====================================================================
// Sprint 6 — returns
// ====================================================================

function trackingQuery(token: string): string {
  return `t=${encodeURIComponent(token)}`;
}

export async function getReturnEligibility(
  orderNumber: string,
  token: string,
): Promise<ReturnEligibilityResponse> {
  const res = await fetch(
    `${BASE}/public/tracking/${encodeURIComponent(orderNumber)}/returnable?${trackingQuery(token)}`,
    { cache: 'no-store' },
  );
  return (await readJsonOrThrow(res)) as ReturnEligibilityResponse;
}

export async function uploadReturnPhoto(
  orderNumber: string,
  token: string,
  file: File,
): Promise<ReturnPhotoUploadResponse> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch(
    `${BASE}/public/tracking/${encodeURIComponent(orderNumber)}/return-photo?${trackingQuery(token)}`,
    { method: 'POST', body: fd },
  );
  return (await readJsonOrThrow(res)) as ReturnPhotoUploadResponse;
}

export async function createReturnRequest(
  orderNumber: string,
  token: string,
  body: CreateReturnRequest,
): Promise<{ returnNumber: string; state: string }> {
  const res = await fetch(
    `${BASE}/public/tracking/${encodeURIComponent(orderNumber)}/return?${trackingQuery(token)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return (await readJsonOrThrow(res)) as { returnNumber: string; state: string };
}

export async function getReturnSummary(
  orderNumber: string,
  returnNumber: string,
  token: string,
): Promise<CustomerReturnSummary> {
  const res = await fetch(
    `${BASE}/public/tracking/${encodeURIComponent(orderNumber)}/return/${encodeURIComponent(returnNumber)}?${trackingQuery(token)}`,
    { cache: 'no-store' },
  );
  return (await readJsonOrThrow(res)) as CustomerReturnSummary;
}

export async function cancelReturnRequest(
  orderNumber: string,
  returnNumber: string,
  token: string,
  reason?: string,
): Promise<CustomerReturnSummary> {
  const res = await fetch(
    `${BASE}/public/tracking/${encodeURIComponent(orderNumber)}/return/${encodeURIComponent(returnNumber)}/cancel?${trackingQuery(token)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  return (await readJsonOrThrow(res)) as CustomerReturnSummary;
}
