'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ShoppingBag } from 'lucide-react';
import type { AdminOrderListItem } from '@repo/types';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';

interface OrdersListProps {
  initial: AdminOrderListItem[];
  page: number;
  limit: number;
  total: number;
  initialQuery: string;
  initialState: string;
  initialPaymentState: string;
}

const STATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All states' },
  { value: 'payment_pending', label: 'Payment pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'refunded', label: 'Refunded' },
];

const PAYMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All payment states' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export function OrdersList({
  initial,
  page,
  limit,
  total,
  initialQuery,
  initialState,
  initialPaymentState,
}: OrdersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);

  // Debounced URL update — same pattern as products list. Server fetches fresh data
  // on every URL change via the Server Component refetch.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (query) next.set('q', query);
      else next.delete('q');
      next.delete('page');
      router.replace(`/orders?${next.toString()}`);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, initialQuery, router, searchParams]);

  function patchParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`/orders?${next.toString()}`);
  }

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    router.replace(`/orders?${next.toString()}`);
  }

  const columns: DataTableColumn<AdminOrderListItem>[] = [
    {
      key: 'orderNumber',
      header: 'Order',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-mono text-[12.5px] text-ink-900">{row.orderNumber}</div>
          <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-400">
            {row.itemCount} item{row.itemCount === 1 ? '' : 's'}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] text-ink-900">{row.customerName}</div>
          <div className="truncate font-mono text-[10.5px] text-ink-500">{row.customerPhone}</div>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (row) => <Pill tone={toneForState(row.state)} withDot>
        {prettify(row.state)}
      </Pill>,
    },
    {
      key: 'paymentState',
      header: 'Payment',
      render: (row) => <Pill tone={toneForPayment(row.paymentState)}>{prettify(row.paymentState)}</Pill>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => (
        <span className="font-mono text-[12.5px] text-ink-900">
          ₹{(row.totalPaisa / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'placedAt',
      header: 'Placed',
      render: (row) => (
        <span className="font-mono text-[11.5px] text-ink-500">
          {new Date(row.placedAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order number, customer name, phone, or email"
            className="pl-10"
          />
        </div>
        <select
          value={initialState}
          onChange={(e) => patchParam('state', e.target.value)}
          className="flex h-12 rounded-xl border border-ink-200 bg-snow px-3.5 text-[13px] text-ink-900"
        >
          {STATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={initialPaymentState}
          onChange={(e) => patchParam('paymentState', e.target.value)}
          className="flex h-12 rounded-xl border border-ink-200 bg-snow px-3.5 text-[13px] text-ink-900"
        >
          {PAYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <DataTable<AdminOrderListItem>
        rows={initial}
        columns={columns}
        rowKey={(r) => r.id}
        gridTemplate="minmax(0,1.3fr) minmax(0,1.6fr) 140px 110px 100px 140px"
        rowHref={(r) => `/orders/${r.orderNumber}`}
        pagination={{ page, limit, total, onPageChange: handlePageChange }}
        mobileCard={(row) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="font-mono text-[12px] text-ink-900">{row.orderNumber}</div>
              <Pill tone={toneForState(row.state)} withDot>
                {prettify(row.state)}
              </Pill>
            </div>
            <div className="text-[12px] text-ink-700">{row.customerName}</div>
            <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
              <span>{row.itemCount} items · {prettify(row.paymentState)}</span>
              <span className="text-ink-900">₹{(row.totalPaisa / 100).toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={<ShoppingBag className="h-7 w-7" />}
            title="No orders match these filters"
            description={query ? `No orders found for "${query}".` : 'Orders will appear here once customers check out.'}
          />
        }
      />
    </>
  );
}

function prettify(state: string): string {
  return state.replace(/_/g, ' ');
}

function toneForState(
  state: string,
): 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'clay' {
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
      return 'danger';
    case 'refunded':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function toneForPayment(state: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (state) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}
