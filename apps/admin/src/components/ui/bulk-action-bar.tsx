'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'ghost' | 'outline';
  disabled?: boolean;
}

interface BulkActionBarProps {
  count: number;
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}

// Floating dark bar that appears when items are selected. MOOL pattern: ink-900 bg, snow text,
// pill-style action buttons on the right. Animates in via Tailwind transition.
export function BulkActionBar({ count, actions, onClear, className }: BulkActionBarProps) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        'sticky bottom-3 z-30 mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-snow shadow-soft-md',
        'md:bottom-6',
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md text-snow/70 hover:text-snow"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="text-[13px]">
          <span className="font-mono">{count}</span> selected
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {actions.map((a) => (
          <Button
            key={a.label}
            size="sm"
            variant={a.variant ?? 'secondary'}
            onClick={a.onClick}
            disabled={a.disabled}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
