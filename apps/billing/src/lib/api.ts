const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN = process.env.BILLING_API_TOKEN;

function authHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  return headers;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  label: string;
  pricePaisa: number;
  stockCount: number;
  isActive: boolean;
  imageUrl?: string;
}

export interface PosProduct {
  id: string;
  name: string;
  imageUrl?: string;
  variants: ProductVariant[];
}

export interface UpiSlot {
  upiId: string;
  label: string;
}

export interface PosSettings {
  upiId: string;
  upiDisplayName: string;
  upiSlots: UpiSlot[];
  upiActiveIndex: number;
}

export interface CreatePosOrderRequest {
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  items: Array<{ variantId: string; quantity: number; pricePaisa: number }>;
  totalPaisa: number;
  discountPaisa?: number;
  couponCode?: string;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  items: Array<{
    variantId: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    pricePaisa: number;
  }>;
  totalPaisa: number;
  discountPaisa?: number;
  couponCode?: string;
  billUrl?: string;
  whatsappUrl?: string;
  createdAt: string;
}

export interface CreatePosOrderResponse {
  orderNumber: string;
  totalPaisa: number;
  billUrl?: string;
  whatsappUrl?: string;
  customerPhone: string;
}

export async function searchProducts(q: string): Promise<PosProduct[]> {
  const res = await fetch(
    `${API_URL}/api/v1/pos/products/search?q=${encodeURIComponent(q)}`,
    { headers: authHeaders(), cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.products ?? data ?? [];
}

export async function createPosOrder(
  body: CreatePosOrderRequest
): Promise<CreatePosOrderResponse> {
  const res = await fetch(`${API_URL}/api/v1/pos/orders`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to create order: ${msg}`);
  }
  return res.json();
}

export async function getPosOrders(filter?: string): Promise<PosOrder[]> {
  const params = filter ? `?filter=${filter}` : '';
  const res = await fetch(`${API_URL}/api/v1/pos/orders${params}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders ?? data ?? [];
}

export async function getPosSettings(): Promise<PosSettings> {
  const res = await fetch(`${API_URL}/api/v1/pos/settings`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { upiId: '', upiDisplayName: 'Reloaded Mens', upiSlots: [], upiActiveIndex: 0 };
  }
  return res.json();
}

export async function switchUpiActive(index: number): Promise<void> {
  await fetch(`${API_URL}/api/v1/pos/upi/switch`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ index }),
  });
}

export async function applyCoupon(
  code: string,
  totalPaisa: number
): Promise<{ discountPaisa: number; message?: string } | null> {
  const res = await fetch(`${API_URL}/api/v1/pos/coupons/validate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code, totalPaisa }),
  });
  if (!res.ok) return null;
  return res.json();
}
