'use client';

// Sprint 9 Phase 3a/3b — mobile-first inventory list.
//   - Cards on mobile, table on desktop.
//   - Inline +1 / +5 / -1 buttons with optimistic updates + Undo toast (3a).
//   - Top stat row, filter chips, sort dropdown, sticky search + barcode
//     scan, infinite scroll on mobile (3b).
// The legacy AdjustDrawer is still reachable from the kebab + a "Custom"
// link on each card for damage/correction notes.

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Minus, Package, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { InventorySort, InventoryStockFilter } from '@repo/types';
import { BarcodeScanButton } from '@/components/ui/barcode-scan-button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { KebabMenu } from '@/components/ui/kebab-menu';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Pill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AdjustDrawer } from './adjust-drawer';
import { loadMoreInventoryAction, quickAdjustStockAction } from './actions';

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

export interface InventoryAggregates {
  total: number;
  inStock: number;
  low: number;
  out: number;
}

interface InventoryListProps {
  initial: InventoryListItem[];
  page: number;
  limit: number;
  total: number;
  aggregates: InventoryAggregates;
  initialQuery: string;
  initialStockFilter: InventoryStockFilter;
  initialSort: InventorySort;
}

const STOCK_FILTERS: Array<{ value: InventoryStockFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low', label: 'Low' },
  { value: 'out', label: 'Out' },
];

const SORT_OPTIONS: Array<{ value: InventorySort; label: string }> = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'lowest_stock', label: 'Lowest stock' },
  { value: 'name_asc', label: 'Product A-Z' },
  { value: 'sku_asc', label: 'SKU A-Z' },
];

export function InventoryList({
  initial,
  page,
  limit,
  total,
  aggregates,
  initialQuery,
  initialStockFilter,
  initialSort,
}: InventoryListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);
  const stockFilter = initialStockFilter;
  const sort = initialSort;
  const [adjusting, setAdjusting] = React.useState<InventoryListItem | null>(null);

  // Optimistic overlay — variantId → local stockCount the operator just tapped.
  // Cleared when the server refresh confirms (router.refresh → initial prop
  // changes → effect resets the map).
  const [optimisticStock, setOptimisticStock] = React.useState<Record<string, number>>({});

  // Infinite scroll accumulator.
  const [extraPages, setExtraPages] = React.useState<InventoryListItem[]>([]);
  const [nextPage, setNextPage] = React.useState(page + 1);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [exhausted, setExhausted] = React.useState(initial.length >= total);

  React.useEffect(() => {
    setExtraPages([]);
    setNextPage(page + 1);
    setExhausted(initial.length >= total);
    setOptimisticStock({});
  }, [initial, page, total]);

  const rows: InventoryListItem[] = React.useMemo(() => {
    const all = [...initial, ...extraPages];
    if (Object.keys(optimisticStock).length === 0) return all;
    return all.map((r) =>
      optimisticStock[r.id] !== undefined ? { ...r, stockCount: optimisticStock[r.id] } : r,
    );
  }, [initial, extraPages, optimisticStock]);

  // -------- URL-state helpers --------

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
  }, [query, initialQuery, router, searchParams]);

  function setStockFilter(value: InventoryStockFilter) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'all') next.delete('stockFilter');
    else next.set('stockFilter', value);
    next.delete('page');
    next.delete('lowStockOnly');
    router.replace(`/inventory?${next.toString()}`);
  }

  function setSortParam(value: InventorySort) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'updated_desc') next.delete('sort');
    else next.set('sort', value);
    router.replace(`/inventory?${next.toString()}`);
  }

  function handlePageChange(nextPageNumber: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPageNumber));
    router.replace(`/inventory?${next.toString()}`);
  }

  // -------- Quick adjust (inline +/-) --------

  async function quickAdjust(row: InventoryListItem, delta: number) {
    const current = optimisticStock[row.id] ?? row.stockCount;
    const target = current + delta;
    if (target < 0) {
      toast.error('Stock cannot go below zero');
      return;
    }
    // Optimistic.
    setOptimisticStock((m) => ({ ...m, [row.id]: target }));
    const result = await quickAdjustStockAction(row.id, delta);
    if (!result.ok) {
      // Roll back.
      setOptimisticStock((m) => {
        const next = { ...m };
        delete next[row.id];
        return next;
      });
      toast.error(result.error ?? 'Failed to adjust');
      return;
    }
    // Show an Undo toast — fires the reverse delta on tap.
    toast.success(`${row.sku} · ${delta > 0 ? '+' : ''}${delta}`, {
      action: {
        label: 'Undo',
        onClick: () => {
          void quickAdjust(row, -delta);
        },
      },
      duration: 4000,
    });
    router.refresh();
  }

  // -------- Infinite scroll sentinel --------

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const loadMoreRef = React.useRef<() => Promise<void>>();
  loadMoreRef.current = async () => {
    if (exhausted || loadingMore) return;
    setLoadingMore(true);
    const result = await loadMoreInventoryAction({
      page: nextPage,
      limit,
      q: query || undefined,
      stockFilter: stockFilter === 'all' ? undefined : stockFilter,
      sort,
    });
    setLoadingMore(false);
    if (!result.ok || !result.data) {
      toast.error(result.error ?? 'Could not load more');
      setExhausted(true);
      return;
    }
    const more = result.data.items as InventoryListItem[];
    setExtraPages((prev) => [...prev, ...more]);
    const loadedSoFar = initial.length + extraPages.length + more.length;
    setNextPage((p) => p + 1);
    if (loadedSoFar >= total || more.length === 0) {
      setExhausted(true);
    }
  };

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sentinelRef.current) return;
    if (exhausted) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !loadingMore) {
            void loadMoreRef.current?.();
          }
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [exhausted, loadingMore]);

  // -------- DataTable columns (desktop) --------

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
      render: (row) => (
        <div data-row-stop className="flex items-center gap-1.5">
          <StockPill stockCount={row.stockCount} threshold={row.lowStockThreshold} />
          <QuickAdjustButtons row={row} onAdjust={quickAdjust} compact />
        </div>
      ),
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
            <DropdownMenuItem onClick={() => setAdjusting(row)}>Adjust with note</DropdownMenuItem>
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
      {/* Top stat row — tappable tiles. Each click sets the filter chip. */}
      <div className="mb-4 grid grid-cols-3 gap-2 md:gap-3">
        <StatTile
          label="In stock"
          value={aggregates.inStock}
          tone="success"
          active={stockFilter === 'in_stock'}
          onClick={() => setStockFilter(stockFilter === 'in_stock' ? 'all' : 'in_stock')}
        />
        <StatTile
          label="Low"
          value={aggregates.low}
          tone="warning"
          active={stockFilter === 'low'}
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
        />
        <StatTile
          label="Out"
          value={aggregates.out}
          tone="danger"
          active={stockFilter === 'out'}
          onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
        />
      </div>

      {/* Sticky-on-mobile filter strip: search + scan + chips + sort. Desktop
          renders it inline (no sticky). */}
      <div className="sticky top-0 z-10 -mx-5 mb-3 space-y-2 border-b border-ink-100 bg-bone/95 px-5 py-2.5 backdrop-blur-md md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU or product"
              className="pl-10 font-mono uppercase tracking-caps"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="search"
              type="search"
              aria-label="Search inventory"
            />
          </div>
          <BarcodeScanButton onDetected={(value) => setQuery(value)} className="h-12 w-12" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {STOCK_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStockFilter(f.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-caps transition',
                  stockFilter === f.value
                    ? 'border-ink-900 bg-ink-900 text-snow'
                    : 'border-ink-200 bg-snow text-ink-700 hover:border-ink-900',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSortParam(e.target.value as InventorySort)}
              className="h-8 appearance-none rounded-md border border-ink-200 bg-snow pl-3 pr-7 font-mono text-[11px] uppercase tracking-caps text-ink-700"
              aria-label="Sort"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DataTable<InventoryListItem>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        gridTemplate="minmax(0,1.3fr) minmax(0,1.4fr) 220px 60px minmax(0,1.2fr) 44px"
        pagination={{ page, limit, total, onPageChange: handlePageChange }}
        mobileCard={(row) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[12px] text-ink-900">{row.sku}</div>
              <Link
                href={`/products/${row.product.id}`}
                className="block truncate text-[12px] text-ink-500 hover:text-ink-900"
                data-row-stop
              >
                {row.product.name}
              </Link>
              <div className="mt-1 text-[11px] text-ink-500">
                {[row.size, row.color].filter(Boolean).join(' · ') || 'No axis'} · low at{' '}
                <span className="font-mono">{row.lowStockThreshold}</span>
              </div>
              <div className="mt-2" data-row-stop>
                <StockPill stockCount={row.stockCount} threshold={row.lowStockThreshold} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2" data-row-stop>
              <QuickAdjustButtons row={row} onAdjust={quickAdjust} />
              <button
                type="button"
                onClick={() => setAdjusting(row)}
                className="text-[11px] text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
              >
                Custom…
              </button>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={<Package className="h-7 w-7" />}
            title="Nothing matches this view"
            description={
              query
                ? `No SKU or product name matches "${query}".`
                : stockFilter !== 'all'
                  ? 'Try a different stock filter.'
                  : 'Create a product and add variants to see stock here.'
            }
            action={
              stockFilter !== 'all' || query ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuery('');
                    setStockFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        }
      />

      {/* Infinite scroll sentinel — mobile only; desktop keeps pagination
          buttons from the DataTable. */}
      <div ref={sentinelRef} className="md:hidden" aria-hidden />
      {loadingMore ? (
        <div className="flex items-center justify-center py-4 text-[12.5px] text-ink-500 md:hidden">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          Loading more…
        </div>
      ) : null}

      <AdjustDrawer
        variant={
          adjusting
            ? {
                id: adjusting.id,
                sku: adjusting.sku,
                size: adjusting.size,
                color: adjusting.color,
                stockCount: optimisticStock[adjusting.id] ?? adjusting.stockCount,
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

// =====================================================
// Sub-components
// =====================================================

function StatTile({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger';
  active: boolean;
  onClick: () => void;
}) {
  const toneRing =
    tone === 'success'
      ? 'ring-success/40'
      : tone === 'warning'
        ? 'ring-warning/40'
        : 'ring-danger/40';
  const toneText =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-danger';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-ink-100 bg-snow px-3 py-3 text-left transition hover:border-ink-300 active:scale-[0.99]',
        active && `ring-2 ${toneRing}`,
      )}
      aria-pressed={active}
    >
      <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">{label}</div>
      <div className={cn('mt-1 font-display text-[24px] font-semibold leading-none', toneText)}>
        {value}
      </div>
    </button>
  );
}

function QuickAdjustButtons({
  row,
  onAdjust,
  compact = false,
}: {
  row: InventoryListItem;
  onAdjust: (row: InventoryListItem, delta: number) => Promise<void>;
  compact?: boolean;
}) {
  const sizeClass = compact ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Remove 1 from ${row.sku}`}
        onClick={() => onAdjust(row, -1)}
        disabled={row.stockCount <= 0}
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-ink-200 bg-snow text-ink-900 transition active:scale-95 disabled:opacity-30',
          sizeClass,
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Add 1 to ${row.sku}`}
        onClick={() => onAdjust(row, 1)}
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-ink-200 bg-snow text-ink-900 transition active:scale-95',
          sizeClass,
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Add 5 to ${row.sku}`}
        onClick={() => onAdjust(row, 5)}
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-ink-900 text-snow transition active:scale-95',
          compact ? 'h-7 px-1.5 text-[10.5px]' : 'h-9 px-2 text-[11px]',
        )}
      >
        +5
      </button>
    </div>
  );
}

function StockPill({ stockCount, threshold }: { stockCount: number; threshold: number }) {
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
