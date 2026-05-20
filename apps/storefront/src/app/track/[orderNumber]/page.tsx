import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { TrackingOrder } from '@repo/types';
import { Pill } from '@/components/ui/pill';
import { publicApi } from '@/lib/api';
import { getCustomerOrder } from '@/lib/customer-server';
import { TrackingView } from './tracking-view';

export const metadata = { title: 'Track your order' };

interface PageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ t?: string }>;
}

export default async function TrackingPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params;
  const sp = (await searchParams) ?? {};
  let token = sp.t ?? '';

  // No token in the URL — try the logged-in customer's own copy of the
  // order. customer-orders/:orderNumber is scoped to the auth cookie, so it
  // only returns the row if THIS customer actually placed THIS order. The
  // trackingToken comes off that row and we fall through to the normal
  // public-tracking fetch as if the customer had landed here from the
  // confirmation email link.
  if (!token) {
    const sessionOrder = await getCustomerOrder(orderNumber);
    if (sessionOrder?.trackingToken) {
      token = sessionOrder.trackingToken;
    } else {
      notFound();
    }
  }

  const res = await publicApi<TrackingOrder>(
    `/public/tracking/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`,
  );
  if (!res.ok || !res.body) {
    // Either 401 (bad token) or 404 (no such order). Fall through to notFound so the
    // 404 page renders rather than leaking which case it was.
    notFound();
  }
  const order = res.body;

  return (
    <div className="mx-auto w-full max-w-[960px] px-5 py-6 md:px-8 md:py-10">
      <nav className="label-caps flex items-center gap-1.5" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink-900">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-ink-300" aria-hidden />
        <span className="text-ink-900">Track {order.orderNumber}</span>
      </nav>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
            Order {order.orderNumber}
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-500">
            Placed{' '}
            {new Date(order.placedAt).toLocaleString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <Pill tone={toneForState(order.state)} withDot>
          {order.state.replace(/_/g, ' ')}
        </Pill>
      </header>
      <TrackingView order={order} token={token} />
    </div>
  );
}

function toneForState(
  state: string,
): 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'clay' | 'moss' {
  switch (state) {
    case 'payment_pending':
      return 'warning';
    case 'confirmed':
      return 'info';
    case 'packed':
      return 'clay';
    case 'shipped':
    case 'out_for_delivery':
      return 'info';
    case 'delivered':
      return 'success';
    case 'cancelled':
    case 'payment_failed':
    case 'refunded':
      return 'danger';
    default:
      return 'neutral';
  }
}
