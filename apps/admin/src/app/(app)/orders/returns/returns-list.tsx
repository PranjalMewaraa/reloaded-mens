'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, PackageOpen } from 'lucide-react';
import type { AdminReturnListItem } from '@repo/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';

const TABS = [
  { value: 'requested', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'pickup_scheduled', label: 'Pickup' },
  { value: 'store_dropoff_pending', label: 'Dropoff' },
  { value: 'received', label: 'Received' },
  { value: 'verified', label: 'Verified' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface Props {
  initial: AdminReturnListItem[];
  currentState: string;
}

export function ReturnsList({ initial, currentState }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTab(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('state', value);
    next.delete('page');
    router.replace(`/orders/returns?${next.toString()}`);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={currentState === tab.value ? 'default' : 'outline'}
            onClick={() => switchTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-7 w-7" />}
          title="Nothing in this queue"
          description={`No returns in state "${currentState.replace(/_/g, ' ')}".`}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {initial.map((row) => (
            <li key={row.id} className="rounded-2xl border border-ink-100 bg-snow p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/orders/returns/${row.id}`}
                      className="font-mono text-[13px] text-ink-900 hover:underline"
                    >
                      {row.returnNumber}
                    </Link>
                    <Link
                      href={`/orders/${row.orderNumber}`}
                      className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-500 hover:text-ink-900"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {row.orderNumber}
                    </Link>
                    <Pill tone={toneFor(row.state)} withDot>
                      {row.state.replace(/_/g, ' ')}
                    </Pill>
                    <Pill tone="neutral">{row.method.replace(/_/g, ' ')}</Pill>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-900">{row.customerName}</p>
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    {row.itemCount} line{row.itemCount === 1 ? '' : 's'} · filed{' '}
                    {new Date(row.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {row.primaryPhotoUrls.length > 0 ? (
                  <div className="flex shrink-0 gap-1">
                    {row.primaryPhotoUrls.slice(0, 3).map((url) => (
                      <div key={url} className="relative h-12 w-12 overflow-hidden rounded-md bg-ink-50">
                        <Image
                          src={url}
                          alt="Return photo"
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
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
