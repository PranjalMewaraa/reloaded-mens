'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
}

export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  // Total widths for the desktop grid template. Defaults to a 1fr grid if absent.
  // Example: 'minmax(0,2fr) 1fr 1fr 1fr 60px'. Selection (24px) and chevron columns are
  // appended automatically.
  gridTemplate?: string;
  empty?: React.ReactNode;
  loading?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  pagination?: PaginationProps;
  // Optional click-through (use for desktop row -> detail page).
  rowHref?: (row: T) => string;
  // Mobile (<md) card renderer. Falls back to first-column render if absent.
  mobileCard?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  gridTemplate,
  empty,
  loading,
  selectedIds,
  onSelectionChange,
  pagination,
  rowHref,
  mobileCard,
}: DataTableProps<T>) {
  const selectable = Boolean(onSelectionChange);
  const selected = selectedIds ?? new Set<string>();

  const template = React.useMemo(() => {
    const cols = gridTemplate ?? columns.map(() => 'minmax(0,1fr)').join(' ');
    return selectable ? `24px ${cols}` : cols;
  }, [gridTemplate, columns, selectable]);

  function toggle(id: string, checked: boolean) {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  }

  function toggleAll(checked: boolean) {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? new Set(rows.map((r) => rowKey(r))) : new Set());
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-ink-100 bg-snow md:block">
        <div
          className="label-caps grid h-10 items-center gap-3 border-b border-ink-100 bg-ink-50 px-4 text-ink-500"
          style={{ gridTemplateColumns: template }}
        >
          {selectable ? (
            <div>
              <Checkbox
                checked={allChecked}
                onCheckedChange={(c) => toggleAll(c === true)}
                aria-label="Select all"
              />
            </div>
          ) : null}
          {columns.map((c) => (
            <div key={c.key} className={cn('truncate', c.headClassName)}>
              {c.header}
            </div>
          ))}
        </div>
        {loading ? (
          <div className="divide-y divide-ink-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid h-16 items-center gap-3 px-4"
                style={{ gridTemplateColumns: template }}
              >
                {selectable ? <div /> : null}
                {columns.map((c) => (
                  <Skeleton key={c.key} className="h-4 w-3/4" />
                ))}
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8">{empty}</div>
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((row) => {
              const id = rowKey(row);
              const isSelected = selected.has(id);
              const href = rowHref?.(row);
              return (
                <div
                  key={id}
                  className={cn(
                    'grid h-16 items-center gap-3 px-4 text-[13px]',
                    href ? 'cursor-pointer hover:bg-ink-50/60' : '',
                    isSelected ? 'bg-ink-50/60' : '',
                  )}
                  style={{ gridTemplateColumns: template }}
                  onClick={(e) => {
                    if (!href) return;
                    if ((e.target as HTMLElement).closest('[data-row-stop]')) return;
                    window.location.href = href;
                  }}
                >
                  {selectable ? (
                    <div data-row-stop>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => toggle(id, c === true)}
                        aria-label="Select row"
                      />
                    </div>
                  ) : null}
                  {columns.map((c) => (
                    <div key={c.key} className={cn('min-w-0 truncate', c.className)}>
                      {c.render(row)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-ink-100 bg-snow p-3">
              <Skeleton className="h-12 w-full" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div>{empty}</div>
        ) : (
          rows.map((row) => {
            const id = rowKey(row);
            const href = rowHref?.(row);
            const content = mobileCard
              ? mobileCard(row)
              : columns[0]?.render(row);
            return (
              <div
                key={id}
                className={cn(
                  'rounded-2xl border border-ink-100 bg-snow p-3',
                  href ? 'cursor-pointer' : '',
                )}
                onClick={() => {
                  if (href) window.location.href = href;
                }}
              >
                {content}
              </div>
            );
          })
        )}
      </div>

      {pagination && pagination.total > 0 ? (
        <Pagination {...pagination} />
      ) : null}
    </div>
  );
}

function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-snow px-4 py-2.5 text-[12.5px] text-ink-500">
      <div>
        Showing <span className="font-mono text-ink-900">{from}</span>–
        <span className="font-mono text-ink-900">{to}</span> of{' '}
        <span className="font-mono text-ink-900">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-mono text-[12.5px] text-ink-900">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
