import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, Package } from 'lucide-react';
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
          {items.map((o) => {
            // Build the tracking href. Include `?t=` when we have a token so
            // the URL works for anonymous shares too; if it's missing, the
            // tracking page falls back to a session-based lookup against
            // customer-orders/:orderNumber.
            const trackHref = `/track/${o.orderNumber}${o.trackingToken ? `?t=${o.trackingToken}` : ''}`;

            return (
              // The entire card is one Link so the whole row is a tap target —
              // makes "track this order" the obvious primary action on each
              // row. The inner layout uses flex to keep the visual hierarchy
              // (order id / product / date) on the left, status + total
              // on the right, with a chevron telegraphing the affordance.
              <li key={o.orderNumber}>
                <Link
                  href={trackHref}
                  className="block rounded-2xl border border-ink-100 bg-snow p-4 transition hover:border-ink-300 hover:shadow-soft"
                  aria-label={`Track order ${o.orderNumber}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex items-center gap-2 font-mono text-[13px] text-ink-900">
                        <Package className="h-3.5 w-3.5" />
                        {o.orderNumber}
                      </div>
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
                      {/* Explicit "Track" affordance — small but visible
                          arrow + label so the customer can see this row IS
                          a track-this-order action. */}
                      <span className="hidden items-center gap-1 font-mono text-[10.5px] uppercase tracking-caps text-ink-500 sm:inline-flex">
                        Track
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
