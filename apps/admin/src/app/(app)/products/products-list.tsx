'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Search } from 'lucide-react';
import { toast } from 'sonner';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { bulkDeleteAction, bulkSetActiveAction } from './actions';

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  availabilityFlag: string;
  isActive: boolean;
  primaryImageUrl: string | null;
  variantCount: number;
  categoryIds: string[];
  updatedAt: string;
}

interface ProductsListProps {
  initial: ProductListItem[];
  page: number;
  limit: number;
  total: number;
  initialQuery: string;
  initialIsActive: string;
}

export function ProductsList({
  initial,
  page,
  limit,
  total,
  initialQuery,
  initialIsActive,
}: ProductsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);
  const [isActive, setIsActive] = React.useState(initialIsActive);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  // Debounce the search input → URL params update → server refetch.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (query) next.set('q', query);
      else next.delete('q');
      next.delete('page');
      router.replace(`/products?${next.toString()}`);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  function handleActiveChange(v: string) {
    setIsActive(v);
    const next = new URLSearchParams(searchParams.toString());
    if (v) next.set('isActive', v);
    else next.delete('isActive');
    next.delete('page');
    router.replace(`/products?${next.toString()}`);
  }

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    router.replace(`/products?${next.toString()}`);
  }

  function runBulk(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? 'Failed');
        return;
      }
      toast.success(success);
      setSelected(new Set());
      router.refresh();
    });
  }

  const columns: DataTableColumn<ProductListItem>[] = [
    {
      key: 'image',
      header: '',
      headClassName: 'w-[60px]',
      className: 'w-[60px]',
      render: (row) => (
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-ink-100 bg-ink-50">
          {row.primaryImageUrl ? (
            <Image
              src={row.primaryImageUrl}
              alt={row.name}
              width={48}
              height={48}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <Box className="h-5 w-5 text-ink-300" />
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-ink-900">{row.name}</div>
          <div className="truncate font-mono text-[10.5px] text-ink-400">/{row.slug}</div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (row) => (
        <span className="font-mono text-[12.5px] text-ink-900">
          ₹{(row.basePricePaisa / 100).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'variants',
      header: 'Variants',
      render: (row) => (
        <span className="font-mono text-[12.5px] text-ink-500">{row.variantCount}</span>
      ),
    },
    {
      key: 'availability',
      header: 'Availability',
      render: (row) => (
        <Pill tone={row.availabilityFlag === 'in_store_only' ? 'neutral' : 'info'}>
          {row.availabilityFlag.replace(/_/g, ' ')}
        </Pill>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.isActive ? (
          <Pill tone="success" withDot>
            Active
          </Pill>
        ) : (
          <Pill tone="neutral" withDot>
            Inactive
          </Pill>
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
            placeholder="Search products by name or slug"
            className="pl-10"
          />
        </div>
        <select
          value={isActive}
          onChange={(e) => handleActiveChange(e.target.value)}
          className="flex h-12 rounded-xl border border-ink-200 bg-snow px-3.5 text-[13px] text-ink-900"
        >
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>
      <DataTable<ProductListItem>
        rows={initial}
        columns={columns}
        rowKey={(r) => r.id}
        gridTemplate="60px minmax(0,2fr) 100px 80px 140px 100px"
        selectedIds={selected}
        onSelectionChange={setSelected}
        rowHref={(r) => `/products/${r.id}`}
        pagination={{ page, limit, total, onPageChange: handlePageChange }}
        mobileCard={(row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink-100 bg-ink-50">
              {row.primaryImageUrl ? (
                <Image
                  src={row.primaryImageUrl}
                  alt={row.name}
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <Box className="h-5 w-5 text-ink-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink-900">{row.name}</div>
              <div className="font-mono text-[10.5px] text-ink-400">/{row.slug}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-ink-900">
                  ₹{(row.basePricePaisa / 100).toLocaleString('en-IN')}
                </span>
                <span className="font-mono text-[11px] text-ink-400">·</span>
                <span className="font-mono text-[11px] text-ink-500">
                  {row.variantCount} variants
                </span>
              </div>
            </div>
            {row.isActive ? (
              <Pill tone="success" withDot>
                Active
              </Pill>
            ) : (
              <Pill tone="neutral" withDot>
                Off
              </Pill>
            )}
          </div>
        )}
        empty={
          <EmptyState
            icon={<Box className="h-7 w-7" />}
            title="No products yet"
            description={
              query
                ? `No products match "${query}".`
                : 'Add your first product to get started.'
            }
          />
        }
      />
      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: 'Activate',
            onClick: () =>
              runBulk(() => bulkSetActiveAction(Array.from(selected), true), 'Activated'),
            disabled: pending,
          },
          {
            label: 'Deactivate',
            onClick: () =>
              runBulk(() => bulkSetActiveAction(Array.from(selected), false), 'Deactivated'),
            disabled: pending,
          },
          {
            label: 'Delete',
            variant: 'destructive',
            onClick: () => {
              if (
                typeof window !== 'undefined' &&
                window.confirm(`Soft-delete ${selected.size} product(s)?`)
              ) {
                runBulk(() => bulkDeleteAction(Array.from(selected)), 'Deleted');
              }
            },
            disabled: pending,
          },
        ]}
      />
    </>
  );
}
