import { NextRequest, NextResponse } from 'next/server';
import { createProductSchema } from '@repo/types';
import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => i.message).join('; ');
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const res = await api<{ id: string }>('/products', { method: 'POST', body: parsed.data });
  if (!res.ok || !res.body) {
    const b = res.body as { message?: string | string[]; reason?: string } | null;
    let error = 'Request failed';
    if (b) {
      if (Array.isArray(b.message)) error = b.message.join('; ');
      else if (b.message) error = b.message;
      else if (b.reason) error = b.reason;
    }
    return NextResponse.json({ ok: false, error }, { status: res.status ?? 502 });
  }

  revalidatePath('/products');
  return NextResponse.json({ ok: true, data: { id: res.body.id } });
}
