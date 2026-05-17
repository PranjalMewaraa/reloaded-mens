import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { CustomerReturnSummary } from '@repo/types';
import { publicApi } from '@/lib/api';
import { Pill } from '@/components/ui/pill';
import { ReturnSummary } from './return-summary';

export const metadata = { title: 'Return summary' };

interface PageProps {
  params: Promise<{ orderNumber: string; returnNumber: string }>;
  searchParams?: Promise<{ t?: string }>;
}

export default async function ReturnSummaryPage({ params, searchParams }: PageProps) {
  const { orderNumber, returnNumber } = await params;
  const sp = (await searchParams) ?? {};
  const token = sp.t ?? '';
  if (!token) notFound();

  const res = await publicApi<CustomerReturnSummary>(
    `/public/tracking/${encodeURIComponent(orderNumber)}/return/${encodeURIComponent(returnNumber)}?t=${encodeURIComponent(token)}`,
  );
  if (!res.ok || !res.body) notFound();

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-6 md:px-8 md:py-10">
      <Link
        href={`/track/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to tracking
      </Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
            Return {res.body.returnNumber}
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-500">
            Filed{' '}
            {new Date(res.body.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            for order {orderNumber}
          </p>
        </div>
        <Pill tone={toneFor(res.body.state)} withDot>
          {res.body.state.replace(/_/g, ' ')}
        </Pill>
      </header>
      <ReturnSummary
        orderNumber={orderNumber}
        token={token}
        initial={res.body}
      />
    </div>
  );
}

function toneFor(
  state: string,
): 'warning' | 'info' | 'clay' | 'success' | 'neutral' | 'danger' {
  switch (state) {
    case 'requested':
      return 'warning';
    case 'approved':
    case 'pickup_scheduled':
    case 'store_dropoff_pending':
      return 'info';
    case 'in_transit':
    case 'received':
      return 'clay';
    case 'verified':
    case 'completed':
      return 'success';
    case 'rejected':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}
