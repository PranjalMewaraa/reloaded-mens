'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { bulkEditAction } from './actions';

export interface FlatCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface BulkEditPanelProps {
  open: boolean;
  selectedIds: string[];
  categories: FlatCategory[];
  onClose: () => void;
  onDone: () => void;
}

type AvailabilityValue = 'online_shippable' | 'in_store_only' | 'both' | '';
type GstValue = '0' | '5' | '12' | '18' | '28' | '';
type ActiveValue = 'true' | 'false' | '';

// "no change" sentinel is an empty string for each field.
// Only fields with a non-empty value are included in the patch.

export function BulkEditPanel({
  open,
  selectedIds,
  categories,
  onClose,
  onDone,
}: BulkEditPanelProps) {
  const [availability, setAvailability] = React.useState<AvailabilityValue>('');
  const [gst, setGst] = React.useState<GstValue>('');
  const [active, setActive] = React.useState<ActiveValue>('');
  // Category assignment mode: '' = no change, 'set' = replace with chosen set
  const [catMode, setCatMode] = React.useState<'' | 'set'>('');
  const [chosenCatIds, setChosenCatIds] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  // Reset when panel opens with a new selection.
  React.useEffect(() => {
    if (open) {
      setAvailability('');
      setGst('');
      setActive('');
      setCatMode('');
      setChosenCatIds(new Set());
    }
  }, [open]);

  const hasChanges =
    availability !== '' || gst !== '' || active !== '' || catMode === 'set';

  function toggleCat(id: string) {
    setChosenCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    const patch: Parameters<typeof bulkEditAction>[0]['patch'] = {};
    if (availability !== '') patch.availabilityFlag = availability;
    if (gst !== '') patch.gstRatePercent = Number(gst);
    if (active !== '') patch.isActive = active === 'true';
    if (catMode === 'set') patch.categoryIds = Array.from(chosenCatIds);

    startTransition(async () => {
      const result = await bulkEditAction({ ids: selectedIds, patch });
      if (!result.ok) {
        toast.error(result.error ?? 'Some products could not be updated');
        return;
      }
      toast.success(`Updated ${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'}`);
      onDone();
    });
  }

  // Build indented category labels for the checkbox list.
  const depthMap = React.useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const depths = new Map<string, number>();
    function depth(id: string): number {
      if (depths.has(id)) return depths.get(id)!;
      const node = byId.get(id);
      const d = node?.parentId ? depth(node.parentId) + 1 : 0;
      depths.set(id, d);
      return d;
    }
    categories.forEach((c) => depth(c.id));
    return depths;
  }, [categories]);

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'}</SheetTitle>
          <SheetDescription>
            Only fields you change will be applied. Leave everything blank to make no change.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as ActiveValue)}
              className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
            >
              <option value="">— no change —</option>
              <option value="true">Active (visible on storefront)</option>
              <option value="false">Inactive (hidden)</option>
            </select>
          </div>

          {/* Availability */}
          <div className="space-y-1.5">
            <Label>Availability</Label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value as AvailabilityValue)}
              className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
            >
              <option value="">— no change —</option>
              <option value="online_shippable">Online (shippable)</option>
              <option value="in_store_only">In-store only</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* GST rate */}
          <div className="space-y-1.5">
            <Label>GST rate</Label>
            <select
              value={gst}
              onChange={(e) => setGst(e.target.value as GstValue)}
              className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
            >
              <option value="">— no change —</option>
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCatMode('')}
                className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                  catMode === ''
                    ? 'border-ink-900 bg-ink-900 text-snow'
                    : 'border-ink-200 bg-snow text-ink-700 hover:border-ink-400'
                }`}
              >
                No change
              </button>
              <button
                type="button"
                onClick={() => setCatMode('set')}
                className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
                  catMode === 'set'
                    ? 'border-ink-900 bg-ink-900 text-snow'
                    : 'border-ink-200 bg-snow text-ink-700 hover:border-ink-400'
                }`}
              >
                Replace with…
              </button>
            </div>

            {catMode === 'set' && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-ink-200 bg-snow">
                {categories.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-ink-400">No categories yet.</p>
                ) : (
                  categories.map((cat) => {
                    const depth = depthMap.get(cat.id) ?? 0;
                    return (
                      <label
                        key={cat.id}
                        className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 hover:bg-ink-50"
                        style={{ paddingLeft: `${16 + depth * 16}px` }}
                      >
                        <input
                          type="checkbox"
                          checked={chosenCatIds.has(cat.id)}
                          onChange={() => toggleCat(cat.id)}
                          className="h-4 w-4 rounded border-ink-300 accent-ink-900"
                        />
                        <span className="text-[13px] text-ink-900">{cat.name}</span>
                        <span className="ml-auto font-mono text-[10.5px] text-ink-400">
                          {cat.slug}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
            {catMode === 'set' && (
              <p className="text-[11.5px] text-ink-400">
                This replaces all existing category assignments on the selected products.
              </p>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={pending || !hasChanges}>
            {pending ? 'Applying…' : `Apply to ${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
