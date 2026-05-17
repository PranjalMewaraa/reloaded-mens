import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Package } from 'lucide-react';
import { getCustomerOrders, getCustomerProfile } from '@/lib/customer-server';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { EmptyState } from '@/components/product/empty-state';
import { formatINR } from '@/lib/utils';

export const metadata = { title: 'Your orders' };

interface PageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const customer = await getCustomerProfile();
  if (!customer) redirect('/account/login?next=/account/orders');
  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number(sp.page) || 1);
  const orders = await getCustomerOrders(page);
  const items = orders?.items ?? [];

  return (
    <div className="mx-auto max-w-[840px] px-4 py-8 md:py-12">
      <p className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
        <Link href="/account" className="hover:underline">
          Account
        </Link>{' '}
        / Orders
      </p>
      <h1 className="mt-1 font-display text-[26px] font-semibold text-ink-900">Your orders</h1>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders yet"
            description="Once you place an order, it'll show up here with tracking and reorder shortcuts."
            action={
              <Button asChild>
                <Link href="/shop">Browse the shop</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((o) => (
            <li key={o.orderNumber} className="rounded-2xl border border-ink-100 bg-snow p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/track/${o.orderNumber}${o.trackingToken ? `?t=${o.trackingToken}` : ''}`}
                    className="inline-flex items-center gap-2 font-mono text-[13px] text-ink-900 hover:underline"
                  >
                    <Package className="h-3.5 w-3.5" />
                    {o.orderNumber}
                  </Link>
                  <p className="mt-1 text-[12.5px] text-ink-700">
                    {o.primaryProductName}
                    {o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ''}
                  </p>
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    {new Date(o.placedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone="neutral">{o.state.replace(/_/g, ' ')}</Pill>
                  <span className="font-mono text-[14px] font-semibold text-ink-900">
                    {formatINR(o.totalPaisa)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
