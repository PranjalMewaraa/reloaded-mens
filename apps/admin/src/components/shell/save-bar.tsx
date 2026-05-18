'use client';

import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { cn } from '@/lib/utils';

interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  onDiscard?: () => void;
  onSave: () => void;
  saveLabel?: string;
  className?: string;
}

// Fixed bottom save bar for editor pages. Only visible when there are unsaved
// changes (or saving is in progress) so the page stays uncluttered during read
// flows.
//
// Phase 2c — switched from `sticky` to `fixed` positioning so it sits above
// mobile browser chrome (Safari URL bar) and respects the iOS home-indicator
// safe area. Editor pages add ~80 px bottom padding to their scroll container
// so the bar doesn't permanently mask the last section.
export function SaveBar({
  dirty,
  saving,
  onDiscard,
  onSave,
  saveLabel = 'Save changes',
  className,
}: SaveBarProps) {
  if (!dirty && !saving) return null;
  return (
    <div
      className={cn(
        'fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-[1280px] items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-snow px-4 py-3 shadow-soft-md',
        // Safe-area-aware bottom inset so iOS notch / home-indicator don't
        // collide with the bar. Falls back to bottom-3 on browsers without env().
        'pb-[max(0px,env(safe-area-inset-bottom))]',
        'md:inset-x-auto md:left-1/2 md:bottom-6 md:-translate-x-1/2 md:px-5 md:py-3.5',
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-3">
        <Pill tone="warning" withDot>
          {saving ? 'Saving…' : 'Unsaved changes'}
        </Pill>
      </div>
      <div className="flex items-center gap-2">
        {onDiscard ? (
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
        ) : null}
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  );
}
