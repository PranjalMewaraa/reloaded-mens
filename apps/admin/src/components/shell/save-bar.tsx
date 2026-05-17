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

// Sticky bottom save bar for editor pages. Only visible when there are unsaved changes
// (or saving is in progress) so the page stays uncluttered during read flows.
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
        'sticky bottom-3 z-30 mx-auto mt-6 flex w-full max-w-[1280px] items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-snow px-4 py-3 shadow-soft-md',
        'md:bottom-6 md:px-5 md:py-3.5',
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
