import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import type { ReturnEligibilityResponse } from '@repo/types';
import { publicApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ReturnFlow } from './return-flow';

export const metadata = { title: 'Return or exchange' };

interface PageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ t?: string }>;
}

export default async function ReturnFlowPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params;
  const sp = (await searchParams) ?? {};
  const token = sp.t ?? '';
  if (!token) notFound();

  const res = await publicApi<ReturnEligibilityResponse>(
    `/public/tracking/${encodeURIComponent(orderNumber)}/returnable?t=${encodeURIComponent(token)}`,
  );
  if (!res.ok || !res.body) notFound();
  const eligibility = res.body;

  // Open return already exists — redirect feel via a banner + link rather than a hard
  // bounce; the summary page lives at /track/[orderNumber]/return/[returnNumber].
  if (eligibility.openReturnNumber) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-5 py-10 md:px-8 md:py-16">
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink-900">
          A return is already in progress
        </h1>
        <p className="mt-2 text-[13px] text-ink-500">
          Order {orderNumber} has an active return ({eligibility.openReturnNumber}).
          Track its progress or cancel it from the summary page.
        </p>
        <div className="mt-4 flex gap-2">
          <Button asChild>
            <Link
              href={`/track/${encodeURIComponent(orderNumber)}/return/${encodeURIComponent(eligibility.openReturnNumber)}?t=${encodeURIComponent(token)}`}
            >
              Open return {eligibility.openReturnNumber}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/track/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!eligibility.withinWindow || eligibility.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-5 py-10 md:px-8 md:py-16">
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink-900">
          Returns aren&apos;t available for this order
        </h1>
        <p className="mt-2 text-[13px] text-ink-500">
          {eligibility.withinWindow
            ? 'Nothing on this order is eligible to return right now.'
            : `The ${eligibility.windowDays}-day return window has closed. Message us on WhatsApp if you need help.`}
        </p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href={`/track/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back to tracking
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-6 md:px-8 md:py-10">
      <Link
        href={`/track/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to tracking
      </Link>
      <h1 className="mt-3 font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
        Return or exchange
      </h1>
      <p className="mt-1 text-[12.5px] text-ink-500">
        Order {orderNumber} · {eligibility.daysRemaining} day
        {eligibility.daysRemaining === 1 ? '' : 's'} left in the return window
      </p>
      <ReturnFlow orderNumber={orderNumber} token={token} eligibility={eligibility} />
    </div>
  );
}
