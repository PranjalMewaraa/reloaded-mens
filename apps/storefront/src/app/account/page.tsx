import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Package, Settings } from 'lucide-react';
import { getCustomerOrders, getCustomerProfile } from '@/lib/customer-server';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { formatINR } from '@/lib/utils';
import { LogoutButton } from './logout-button';

export const metadata = { title: 'Your account' };

export default async function AccountHome() {
  const customer = await getCustomerProfile();
  if (!customer) redirect('/account/login?next=/account');
  const orders = await getCustomerOrders(1);
  const recent = orders?.items.slice(0, 3) ?? [];

  return (
    <div className="mx-auto max-w-[840px] px-4 py-8 md:py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Welcome back</p>
          <h1 className="font-display text-[26px] font-semibold text-ink-900">
            {customer.name ?? customer.phone}
          </h1>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/account/orders"
          className="group rounded-2xl border border-ink-100 bg-snow p-5 transition hover:border-ink-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                Your orders
              </h2>
              <p className="mt-1 text-[16px] font-medium text-ink-900">
                {orders?.total ?? 0} order{orders?.total === 1 ? '' : 's'}
              </p>
            </div>
            <Package className="h-6 w-6 text-ink-500 transition group-hover:text-ink-900" />
          </div>
        </Link>
        <Link
          href="/account/profile"
          className="group rounded-2xl border border-ink-100 bg-snow p-5 transition hover:border-ink-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                Profile
              </h2>
              <p className="mt-1 text-[16px] font-medium text-ink-900">Name, email, consents</p>
            </div>
            <Settings className="h-6 w-6 text-ink-500 transition group-hover:text-ink-900" />
          </div>
        </Link>
      </div>

      {recent.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            Recent orders
          </h2>
          <ul className="mt-3 space-y-2">
            {recent.map((o) => (
              <li
                key={o.orderNumber}
                className="flex items-center justify-between rounded-2xl border border-ink-100 bg-snow p-4"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/track/${o.orderNumber}${o.trackingToken ? `?t=${o.trackingToken}` : ''}`}
                    className="font-mono text-[13px] text-ink-900 hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                  <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-500">
                    {o.primaryProductName}
                    {o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <Pill tone="neutral">{o.state.replace(/_/g, ' ')}</Pill>
                  <span className="font-mono text-[13px] text-ink-900">
                    {formatINR(o.totalPaisa)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {orders && orders.total > recent.length ? (
            <div className="mt-3 text-right">
              <Button asChild variant="outline" size="sm">
                <Link href="/account/orders">See all orders</Link>
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
