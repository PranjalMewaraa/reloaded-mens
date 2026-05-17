'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { KebabMenu } from '@/components/ui/kebab-menu';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Pill } from '@/components/ui/pill';
import { AdjustDrawer } from './adjust-drawer';

export interface InventoryListItem {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockCount: number;
  lowStockThreshold: number;
  isActive: boolean;
  product: { id: string; name: string; slug: string };
  lastEvent: { createdAt: string; changeType: string; delta: number } | null;
  updatedAt: string;
}

interface InventoryListProps {
  initial: InventoryListItem[];
  page: number;
  limit: number;
  total: number;
  initialQuery: string;
  initialLowStockOnly: boolean;
}

export function InventoryList({
  initial,
  page,
  limit,
  total,
  initialQuery,
  initialLowStockOnly,
}: InventoryListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);
  const [lowStockOnly, setLowStockOnly] = React.useState(initialLowStockOnly);
  const [adjusting, setAdjusting] = React.useState<InventoryListItem | null>(null);

  React.useEffect(() => {
    if (query === initialQuery) return;
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (query) next.set('q', query);
      else next.delete('q');
      next.delete('page');
      router.replace(`/inventory?${next.toString()}`);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  function toggleLowStock(v: boolean) {
    setLowStockOnly(v);
    const next = new URLSearchParams(searchParams.toString());
    if (v) next.set('lowStockOnly', 'true');
    else next.delete('lowStockOnly');
    next.delete('page');
    router.replace(`/inventory?${next.toString()}`);
  }

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    router.replace(`/inventory?${next.toString()}`);
  }

  const columns: DataTableColumn<InventoryListItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-mono text-[12.5px] text-ink-900">{row.sku}</div>
          <div className="truncate text-[10.5px] text-ink-500">
            {[row.size, row.color].filter(Boolean).join(' · ') || 'No axis'}
          </div>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <Link
          href={`/products/${row.product.id}`}
          className="truncate text-[13px] text-ink-900 hover:underline"
          data-row-stop
        >
          {row.product.name}
        </Link>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (row) => <StockPill stockCount={row.stockCount} threshold={row.lowStockThreshold} />,
    },
    {
      key: 'threshold',
      header: 'Low at',
      render: (row) => (
        <span className="font-mono text-[12.5px] text-ink-500">{row.lowStockThreshold}</span>
      ),
    },
    {
      key: 'last',
      header: 'Last event',
      render: (row) =>
        row.lastEvent ? (
          <span className="text-[12px] text-ink-500">
            <span className="font-mono">
              {row.lastEvent.delta > 0 ? `+${row.lastEvent.delta}` : row.lastEvent.delta}
            </span>{' '}
            · {row.lastEvent.changeType.replace(/_/g, ' ')}
          </span>
        ) : (
          <span className="text-[12px] text-ink-400">No events</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      headClassName: 'w-[44px]',
      className: 'w-[44px]',
      render: (row) => (
        <div data-row-stop className="flex justify-end">
          <KebabMenu>
            <DropdownMenuItem onClick={() => setAdjusting(row)}>Adjust stock</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/products/${row.product.id}`}>Open product</Link>
            </DropdownMenuItem>
          </KebabMenu>
        </div>
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
            placeholder="Search by SKU or product name"
            className="pl-10"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-900">
          <Checkbox
            checked={lowStockOnly}
            onCheckedChange={(c) => toggleLowStock(c === true)}
          />
          Low stock only
        </label>
      </div>
      <DataTable<InventoryListItem>
        rows={initial}
        columns={columns}
        rowKey={(r) => r.id}
        gridTemplate="minmax(0,1.4fr) minmax(0,1.6fr) 140px 80px minmax(0,1.4fr) 44px"
        pagination={{ page, limit, total, onPageChange: handlePageChange }}
        mobileCard={(row) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[12px] text-ink-900">{row.sku}</div>
              <div className="truncate text-[12px] text-ink-500">{row.product.name}</div>
              <div className="mt-1 text-[11.5px] text-ink-500">
                {[row.size, row.color].filter(Boolean).join(' · ') || 'No axis'} · low at{' '}
                <span className="font-mono">{row.lowStockThreshold}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StockPill stockCount={row.stockCount} threshold={row.lowStockThreshold} />
              <button
                type="button"
                className="text-[11.5px] text-clay-700 underline"
                onClick={() => setAdjusting(row)}
              >
                Adjust
              </button>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={<Package className="h-7 w-7" />}
            title="No inventory yet"
            description={
              query
                ? `Nothing matches "${query}".`
                : 'Create a product and add variants to see stock here.'
            }
          />
        }
      />
      <AdjustDrawer
        variant={
          adjusting
            ? {
                id: adjusting.id,
                sku: adjusting.sku,
                size: adjusting.size,
                color: adjusting.color,
                stockCount: adjusting.stockCount,
                productId: adjusting.product.id,
              }
            : null
        }
        onClose={() => setAdjusting(null)}
        onSaved={() => {
          setAdjusting(null);
          router.refresh();
        }}
      />
    </>
  );
}

function StockPill({
  stockCount,
  threshold,
}: {
  stockCount: number;
  threshold: number;
}) {
  if (stockCount <= 0) {
    return (
      <Pill tone="danger" withDot>
        Out of stock
      </Pill>
    );
  }
  if (stockCount <= threshold) {
    return (
      <Pill tone="warning" withDot>
        Low · {stockCount}
      </Pill>
    );
  }
  return (
    <Pill tone="success" withDot>
      In stock · {stockCount}
    </Pill>
  );
}
