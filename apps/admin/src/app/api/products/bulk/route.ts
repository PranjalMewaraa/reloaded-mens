import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export interface BulkCreateResult {
  created: number;
  failed: number;
  results: Array<{ slug: string; name: string; ok: boolean; id?: string; error?: string }>;
}

// Validation happens in the API (it owns createProductSchema + the 200-item cap);
// this handler only forwards with the admin's cookies.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const res = await api<BulkCreateResult>('/products/bulk', { method: 'POST', body });
  if (!res.ok || !res.body) {
    const b = res.body as { message?: string | string[]; issues?: Array<{ path: string; message: string }> } | null;
    let error = `Bulk create failed (HTTP ${res.status})`;
    if (b?.issues?.length) error = b.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    else if (Array.isArray(b?.message)) error = b.message.join('; ');
    else if (b?.message) error = b.message;
    return NextResponse.json({ error }, { status: res.status || 502 });
  }

  revalidatePath('/products');
  return NextResponse.json(res.body);
}
