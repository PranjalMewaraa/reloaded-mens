'use client';

// Stock adjust drawer used from the /inventory list. The product editor has its own
// inline drawer for matrix-cell clicks — they intentionally share the same server action
// but render in their own context so each page can refresh independently.

import * as React from 'react';
import { toast } from 'sonner';
import { INVENTORY_CHANGE_TYPE, type StockAdjustInput } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { adjustVariantStockAction } from '../products/[id]/actions';

interface AdjustingVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  stockCount: number;
  productId: string;
}

interface AdjustDrawerProps {
  variant: AdjustingVariant | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AdjustDrawer({ variant, onClose, onSaved }: AdjustDrawerProps) {
  const [delta, setDelta] = React.useState('0');
  const [changeType, setChangeType] = React.useState<string>(INVENTORY_CHANGE_TYPE.RESTOCK);
  const [note, setNote] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setDelta('0');
    setChangeType(INVENTORY_CHANGE_TYPE.RESTOCK);
    setNote('');
  }, [variant]);

  function submit() {
    if (!variant) return;
    const d = Number.parseInt(delta, 10);
    if (!Number.isFinite(d) || d === 0) {
      toast.error('Delta must be a non-zero integer');
      return;
    }
    const payload: StockAdjustInput = {
      delta: d,
      changeType: changeType as StockAdjustInput['changeType'],
      note: note.trim() || undefined,
    };
    startTransition(async () => {
      const result = await adjustVariantStockAction(variant.id, variant.productId, payload);
      if (!result.ok) {
        toast.error(result.error ?? 'Adjust failed');
        return;
      }
      toast.success('Stock adjusted');
      onSaved();
    });
  }

  return (
    <Sheet open={Boolean(variant)} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Adjust stock</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {variant ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-ink-50 px-3 py-2.5">
                <div className="font-mono text-[12.5px] text-ink-900">{variant.sku}</div>
                <div className="text-[11.5px] text-ink-500">
                  {[variant.size, variant.color].filter(Boolean).join(' · ') || 'No axis'} · Current stock{' '}
                  <span className="font-mono">{variant.stockCount}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-delta">Delta (positive to add, negative to remove)</Label>
                <Input
                  id="adj-delta"
                  type="number"
                  step="1"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-type">Reason</Label>
                <select
                  id="adj-type"
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
                >
                  {Object.values(INVENTORY_CHANGE_TYPE).map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-note">Note (optional)</Label>
                <Textarea
                  id="adj-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why are you adjusting?"
                />
              </div>
            </div>
          ) : null}
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : 'Apply adjustment'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
