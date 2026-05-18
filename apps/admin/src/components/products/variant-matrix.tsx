'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface VariantRow {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockCount: number;
  lowStockThreshold: number;
  priceOverridePaisa: number | null;
  isActive: boolean;
}

interface VariantMatrixProps {
  variants: VariantRow[];
  // Open the full Adjust drawer (legacy / power path). Wired from the per-row
  // "Adjust with note" link.
  onCellClick?: (variant: VariantRow) => void;
  // Sprint 9 Phase 2a — inline numeric entry. When provided, cells render as
  // <input> instead of <button>; blur or Enter commits the new value. Caller
  // diffs against current stock + writes the InventoryEvent under the hood.
  // Falls back to onCellClick when not provided.
  onInlineStockSet?: (variant: VariantRow, newStockCount: number) => void;
}

// Visual matrix of variants: rows = color, cols = size. MOOL pattern (design doc §10).
// Cell colour-codes stock state per MOOL §11. When `onInlineStockSet` is supplied,
// each cell is an inline numeric input committing on blur/Enter; otherwise the
// legacy button-opens-drawer behaviour kicks in.
export function VariantMatrix({ variants, onCellClick, onInlineStockSet }: VariantMatrixProps) {
  const { sizes, colors, cellMap } = React.useMemo(() => deriveAxes(variants), [variants]);

  if (sizes.length === 0 && colors.length === 0) {
    return (
      <FlatList variants={variants} onCellClick={onCellClick} onInlineStockSet={onInlineStockSet} />
    );
  }

  return (
    <>
      {/* Desktop grid */}
      <div className="hidden overflow-x-auto md:block">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `120px repeat(${Math.max(sizes.length, 1)}, minmax(72px, 1fr))`,
          }}
        >
          {/* Header row: empty corner + size labels */}
          <div />
          {sizes.map((s) => (
            <div
              key={`h-${s ?? 'none'}`}
              className="label-caps flex h-9 items-center justify-center text-ink-500"
            >
              {s ?? '—'}
            </div>
          ))}

          {colors.map((c) => (
            <React.Fragment key={`r-${c ?? 'none'}`}>
              <div className="flex h-10 items-center gap-2 text-[12.5px] text-ink-900">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-ink-200"
                  style={{ backgroundColor: colorSwatchFor(c) }}
                  aria-hidden
                />
                <span className="truncate">{c ?? '—'}</span>
              </div>
              {sizes.map((s) => {
                const v = cellMap.get(cellKey(s, c));
                return (
                  <StockCell
                    key={`c-${s ?? 'none'}-${c ?? 'none'}`}
                    variant={v}
                    onCellClick={onCellClick}
                    onInlineStockSet={onInlineStockSet}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Mobile accordion */}
      <div className="space-y-2 md:hidden">
        {colors.map((c) => (
          <details
            key={`m-${c ?? 'none'}`}
            className="rounded-2xl border border-ink-100 bg-snow"
            open
          >
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[13px] text-ink-900">
              <span
                className="inline-block h-3 w-3 rounded-full border border-ink-200"
                style={{ backgroundColor: colorSwatchFor(c) }}
                aria-hidden
              />
              <span className="flex-1 truncate">{c ?? '—'}</span>
              <span className="font-mono text-[10.5px] text-ink-500">
                {sizes.length} sizes
              </span>
            </summary>
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {sizes.map((s) => {
                const v = cellMap.get(cellKey(s, c));
                if (!v) return null;
                return (
                  <li
                    key={`mc-${s ?? 'none'}-${c ?? 'none'}`}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="label-caps w-10 text-ink-500">{s ?? '—'}</span>
                    <span className="flex-1 truncate font-mono text-[11.5px] text-ink-500">
                      {v.sku}
                    </span>
                    <StockCell
                      variant={v}
                      onCellClick={onCellClick}
                      onInlineStockSet={onInlineStockSet}
                      className="h-10 w-20"
                    />
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}

function FlatList({ variants, onCellClick, onInlineStockSet }: VariantMatrixProps) {
  return (
    <div className="space-y-2">
      {variants.map((v) => (
        <div
          key={v.id}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-100 bg-snow px-3 py-2.5"
        >
          <span className="font-mono text-[12.5px] text-ink-900">{v.sku}</span>
          <StockCell variant={v} onCellClick={onCellClick} onInlineStockSet={onInlineStockSet} />
        </div>
      ))}
    </div>
  );
}

// =====================================================
// StockCell — the colored cell that renders inside both the desktop grid and
// the mobile accordion. Two modes:
//   - inline:  shows an <input> bound to local state; commits via
//              onInlineStockSet on blur or Enter. Designed for thumb-driven
//              first-time stock entry.
//   - legacy:  shows a <button> that fires onCellClick (the existing
//              AdjustDrawer path). Kept so the per-row "Adjust with note" link
//              still works for audit-heavy ops.
// Both modes use the same cellTone() palette so the look is consistent.
// =====================================================

function StockCell({
  variant,
  onCellClick,
  onInlineStockSet,
  className,
}: {
  variant: VariantRow | undefined;
  onCellClick?: (variant: VariantRow) => void;
  onInlineStockSet?: (variant: VariantRow, newStockCount: number) => void;
  className?: string;
}) {
  // Empty cell — the (size, color) pair has no matching variant. Just render a
  // disabled placeholder.
  if (!variant) {
    return (
      <span
        className={cn(
          'flex h-10 items-center justify-center rounded-md border font-mono text-[12.5px]',
          cellTone(undefined),
          className,
        )}
      >
        —
      </span>
    );
  }

  if (onInlineStockSet) {
    return (
      <InlineStockInput
        variant={variant}
        onCommit={(next) => onInlineStockSet(variant, next)}
        className={className}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCellClick?.(variant)}
      className={cn(
        'flex h-10 items-center justify-center rounded-md border font-mono text-[12.5px] transition',
        cellTone(variant),
        'cursor-pointer hover:opacity-80',
        className,
      )}
    >
      {variant.stockCount}
    </button>
  );
}

function InlineStockInput({
  variant,
  onCommit,
  className,
}: {
  variant: VariantRow;
  onCommit: (next: number) => void;
  className?: string;
}) {
  // Local mirror — keeps the input responsive while parent state hasn't refreshed yet.
  // Re-sync when the variant's stockCount changes (e.g. after parent refresh).
  const [value, setValue] = React.useState(String(variant.stockCount));
  React.useEffect(() => {
    setValue(String(variant.stockCount));
  }, [variant.stockCount]);

  function commit() {
    const next = Number.parseInt(value, 10);
    if (!Number.isFinite(next) || next < 0) {
      setValue(String(variant.stockCount));
      return;
    }
    if (next === variant.stockCount) return;
    onCommit(next);
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      pattern="[0-9]*"
      min={0}
      step={1}
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setValue(String(variant.stockCount));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onFocus={(e) => e.currentTarget.select()}
      aria-label={`Stock for ${variant.sku}`}
      className={cn(
        'h-10 w-16 rounded-md border text-center font-mono text-[12.5px] outline-none transition',
        'focus:ring-2 focus:ring-ink-900',
        cellTone(variant),
        className,
      )}
    />
  );
}

function deriveAxes(variants: VariantRow[]) {
  const sizes = new Set<string | null>();
  const colors = new Set<string | null>();
  for (const v of variants) {
    sizes.add(v.size);
    colors.add(v.color);
  }
  const map = new Map<string, VariantRow>();
  for (const v of variants) map.set(cellKey(v.size, v.color), v);
  return {
    sizes: Array.from(sizes),
    colors: Array.from(colors),
    cellMap: map,
  };
}

function cellKey(size: string | null, color: string | null): string {
  return `${size ?? ''}::${color ?? ''}`;
}

// Tailwind classes for the cell tone given a variant's stock state.
function cellTone(v: VariantRow | undefined): string {
  if (!v) return 'border-ink-100 bg-ink-50 text-ink-300';
  if (!v.isActive) return 'border-ink-100 bg-ink-50 text-ink-400';
  if (v.stockCount <= 0) return 'border-2 border-danger bg-danger-100 text-danger';
  if (v.stockCount <= v.lowStockThreshold)
    return 'border-2 border-warning bg-warning-100 text-warning';
  return 'border-ink-100 bg-snow text-ink-900';
}

// Map common color names to hex for the swatch. Unknown names fall back to a neutral grey.
function colorSwatchFor(name: string | null): string {
  if (!name) return '#E5E7EB';
  const key = name.toLowerCase();
  const known: Record<string, string> = {
    black: '#0A0A0A',
    white: '#FFFFFF',
    natural: '#E8E2D2',
    grey: '#9CA3AF',
    gray: '#9CA3AF',
    navy: '#1E3A8A',
    blue: '#2563EB',
    olive: '#556B2F',
    moss: '#2D5A43',
    clay: '#FF5B00',
    red: '#DC2626',
    green: '#16A34A',
    brown: '#7C5A39',
    beige: '#E8D7B7',
  };
  return known[key] ?? '#D1D5DB';
}
