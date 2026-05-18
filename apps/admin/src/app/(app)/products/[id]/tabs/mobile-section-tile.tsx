'use client';

// Phase 2c (mobile) — collapses a section into a one-line summary tile on
// `< md` widths and opens a full-screen sheet to edit. Keeps the desktop
// long-form layout intact (children render inline above `md`).
//
// Usage:
//   <MobileSectionTile title="Categories" summary="Shirts, Casual">
//     <CategoriesTab ... />
//   </MobileSectionTile>
// Renders the inline children directly on desktop; on mobile, renders a tile
// that opens a slide-up sheet whose body is the same children.

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface MobileSectionTileProps {
  title: string;
  // One-line preview shown on the tile when collapsed.
  summary: React.ReactNode;
  children: React.ReactNode;
  // Optional override of the sheet title (defaults to `title`).
  sheetTitle?: string;
}

export function MobileSectionTile({
  title,
  summary,
  children,
  sheetTitle,
}: MobileSectionTileProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Desktop — inline render, untouched */}
      <div className="hidden md:block">{children}</div>

      {/* Mobile — clickable tile + bottom sheet for the focused edit */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-snow px-4 py-3.5 text-left transition hover:border-ink-300"
        >
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
              {title}
            </div>
            <div className="mt-0.5 truncate text-[13px] text-ink-900">{summary}</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
        </button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[92vh] flex-col rounded-t-2xl p-0 [&>button]:hidden"
          >
            <SheetHeader className="border-b border-ink-100 px-5 py-3">
              <SheetTitle>{sheetTitle ?? title}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[max(theme(spacing.4),env(safe-area-inset-bottom))]">
              {children}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
