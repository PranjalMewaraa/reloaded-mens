'use client';

// Filter + sort row for the category page. Each click rewrites the URL so the page is
// fully re-renderable from the URL alone — no client state to keep in sync. The result
// set is fetched server-side in the parent page component.

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Filter as FilterIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'new', label: 'New in' },
  { value: 'price-asc', label: 'Price · low → high' },
  { value: 'price-desc', label: 'Price · high → low' },
] as const;

// Fallback set used when the category result didn't surface any sizes/colors yet.
const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COMMON_COLORS = ['Black', 'White', 'Natural', 'Olive', 'Navy', 'Clay'];

interface FilterBarProps {
  slug: string;
  sizes: string[];
  colors: string[];
  active: { sort: string; size?: string; color?: string };
}

export function CategoryFilterBar({ slug, sizes, colors, active }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState<'filter' | 'sort' | null>(null);

  function patchParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`/c/${slug}${next.toString() ? `?${next.toString()}` : ''}`);
  }

  function clearAll() {
    router.replace(`/c/${slug}`);
  }

  const sizeOptions = sizes.length > 0 ? sizes : COMMON_SIZES;
  const colorOptions = colors.length > 0 ? colors : COMMON_COLORS;
  const activeFilterCount = (active.size ? 1 : 0) + (active.color ? 1 : 0);
  const activeSort = SORTS.find((s) => s.value === active.sort) ?? SORTS[0];

  return (
    <>
      {/* Sticky horizontal bar */}
      <div className="sticky top-14 z-20 flex items-center gap-2 overflow-x-auto border-y border-ink-100 bg-bone/90 px-5 py-2 backdrop-blur-md md:top-16 md:px-8">
        <Button
          variant={activeFilterCount > 0 ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setOpen('filter')}
        >
          <FilterIcon className="mr-1.5 h-3.5 w-3.5" />
          Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen('sort')}>
          Sort: {activeSort.label}
          <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
        {active.size ? (
          <Chip onRemove={() => patchParam('size', null)}>Size: {active.size}</Chip>
        ) : null}
        {active.color ? (
          <Chip onRemove={() => patchParam('color', null)}>Colour: {active.color}</Chip>
        ) : null}
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto whitespace-nowrap text-[12px] text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <Sheet open={open === 'filter'} onOpenChange={(v) => (!v ? setOpen(null) : null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetTitle className="mb-4">Filter</SheetTitle>
          <div className="space-y-6">
            <FilterGroup
              label="Size"
              options={sizeOptions}
              value={active.size}
              onChange={(v) => patchParam('size', v)}
            />
            <FilterGroup
              label="Colour"
              options={colorOptions}
              value={active.color}
              onChange={(v) => patchParam('color', v)}
            />
          </div>
          <div className="mt-6">
            <Button className="w-full" onClick={() => setOpen(null)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={open === 'sort'} onOpenChange={(v) => (!v ? setOpen(null) : null)}>
        <SheetContent side="bottom">
          <SheetTitle className="mb-3">Sort</SheetTitle>
          <ul className="flex flex-col gap-0.5">
            {SORTS.map((s) => (
              <li key={s.value}>
                <button
                  type="button"
                  className={cn(
                    'flex h-11 w-full items-center justify-between rounded-md px-3 text-[14px] hover:bg-ink-50',
                    active.sort === s.value ? 'font-semibold text-ink-900' : 'text-ink-700',
                  )}
                  onClick={() => {
                    patchParam('sort', s.value === 'featured' ? null : s.value);
                    setOpen(null);
                  }}
                >
                  {s.label}
                  {active.sort === s.value ? <span aria-hidden>✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <div className="label-caps mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onChange(active ? null : opt)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12.5px]',
                active
                  ? 'border-ink-900 bg-ink-900 text-snow'
                  : 'border-ink-200 bg-snow text-ink-900 hover:border-ink-900',
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1 text-[12px] text-ink-900">
      {children}
      <button type="button" onClick={onRemove} className="text-ink-500 hover:text-ink-900" aria-label="Remove filter">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
