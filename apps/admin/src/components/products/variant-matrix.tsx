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
  onCellClick?: (variant: VariantRow) => void;
}

// Visual matrix of variants: rows = color, cols = size. MOOL pattern (design doc §10).
// Cell colour-codes stock state per MOOL §11. Click a cell to open the adjust drawer
// (caller supplies onCellClick). Falls back to a flat list if there's no size or color
// axis.
export function VariantMatrix({ variants, onCellClick }: VariantMatrixProps) {
  const { sizes, colors, cellMap } = React.useMemo(() => deriveAxes(variants), [variants]);

  if (sizes.length === 0 && colors.length === 0) {
    return <FlatList variants={variants} onCellClick={onCellClick} />;
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
                  <button
                    key={`c-${s ?? 'none'}-${c ?? 'none'}`}
                    type="button"
                    onClick={() => v && onCellClick?.(v)}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-md border font-mono text-[12.5px] transition',
                      cellTone(v),
                      v ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed',
                    )}
                    disabled={!v}
                  >
                    {v ? v.stockCount : '—'}
                  </button>
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
                    <button
                      type="button"
                      onClick={() => onCellClick?.(v)}
                      className={cn(
                        'flex h-9 w-16 items-center justify-center rounded-md border font-mono text-[12.5px]',
                        cellTone(v),
                      )}
                    >
                      {v.stockCount}
                    </button>
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

function FlatList({ variants, onCellClick }: VariantMatrixProps) {
  return (
    <div className="space-y-2">
      {variants.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onCellClick?.(v)}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left',
            cellTone(v),
          )}
        >
          <span className="font-mono text-[12.5px] text-ink-900">{v.sku}</span>
          <span className="font-mono text-[12.5px]">{v.stockCount}</span>
        </button>
      ))}
    </div>
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
