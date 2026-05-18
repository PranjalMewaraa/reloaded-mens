'use client';

// Stock adjust drawer used from the /inventory list. The product editor has its
// own inline drawer for matrix-cell clicks — they intentionally share the same
// server action but render in their own context so each page can refresh
// independently.
//
// Sprint 9 Phase 3a (mobile):
//   - Bottom sheet on mobile (slide-up), right-side drawer on desktop.
//   - "Add / Remove / Set to" segmented control replaces the signed-delta
//     input. Operators think in verbs, not deltas — the segment is mapped
//     to a delta when the action fires.
//   - Reason chips replace the <select>. Faster tap target on mobile.
//   - Safe-area-aware footer.

import * as React from 'react';
import { Minus, Plus, Equal } from 'lucide-react';
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
import { cn } from '@/lib/utils';
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

type Mode = 'add' | 'remove' | 'set';

const REASON_CHIPS: Array<{ value: StockAdjustInput['changeType']; label: string }> = [
  { value: INVENTORY_CHANGE_TYPE.RESTOCK, label: 'Restock' },
  { value: INVENTORY_CHANGE_TYPE.CORRECTION, label: 'Correction' },
  { value: INVENTORY_CHANGE_TYPE.WRITE_OFF, label: 'Damage' },
  { value: INVENTORY_CHANGE_TYPE.RETURN_RESTOCK, label: 'Return' },
  { value: INVENTORY_CHANGE_TYPE.STORE_SALE, label: 'In-store sale' },
];

export function AdjustDrawer({ variant, onClose, onSaved }: AdjustDrawerProps) {
  const [mode, setMode] = React.useState<Mode>('add');
  const [amount, setAmount] = React.useState('1');
  const [changeType, setChangeType] = React.useState<StockAdjustInput['changeType']>(
    INVENTORY_CHANGE_TYPE.RESTOCK,
  );
  const [note, setNote] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  // Reset on (re)open so an old draft doesn't bleed across variants.
  React.useEffect(() => {
    if (!variant) return;
    setMode('add');
    setAmount('1');
    setChangeType(INVENTORY_CHANGE_TYPE.RESTOCK);
    setNote('');
  }, [variant]);

  // Auto-pick a sensible reason when the mode flips.
  React.useEffect(() => {
    if (mode === 'add') setChangeType(INVENTORY_CHANGE_TYPE.RESTOCK);
    else if (mode === 'remove') setChangeType(INVENTORY_CHANGE_TYPE.CORRECTION);
    else setChangeType(INVENTORY_CHANGE_TYPE.CORRECTION);
  }, [mode]);

  function computeDelta(): number | null {
    const n = Number.parseInt(amount, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    if (mode === 'add') return n;
    if (mode === 'remove') return -n;
    // 'set' — delta is (newAbsolute - current). Variant guaranteed when this fires.
    if (!variant) return null;
    return n - variant.stockCount;
  }

  function submit() {
    if (!variant) return;
    const d = computeDelta();
    if (d === null) {
      toast.error('Enter a non-negative whole number');
      return;
    }
    if (d === 0) {
      toast.error('Nothing to change');
      return;
    }
    const payload: StockAdjustInput = {
      delta: d,
      changeType,
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

  const open = Boolean(variant);

  const body = variant ? (
    <div className="space-y-4">
      <div className="rounded-xl bg-ink-50 px-3 py-2.5">
        <div className="font-mono text-[12.5px] text-ink-900">{variant.sku}</div>
        <div className="text-[11.5px] text-ink-500">
          {[variant.size, variant.color].filter(Boolean).join(' · ') || 'No axis'} · Current stock{' '}
          <span className="font-mono">{variant.stockCount}</span>
        </div>
      </div>

      {/* Mode segmented control */}
      <div>
        <Label>Action</Label>
        <div className="mt-1 inline-flex rounded-xl border border-ink-200 p-0.5">
          <ModeButton mode="add" active={mode === 'add'} onClick={() => setMode('add')}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </ModeButton>
          <ModeButton mode="remove" active={mode === 'remove'} onClick={() => setMode('remove')}>
            <Minus className="mr-1 h-3.5 w-3.5" />
            Remove
          </ModeButton>
          <ModeButton mode="set" active={mode === 'set'} onClick={() => setMode('set')}>
            <Equal className="mr-1 h-3.5 w-3.5" />
            Set to
          </ModeButton>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adj-amount">
          {mode === 'add' ? 'Quantity to add' : mode === 'remove' ? 'Quantity to remove' : 'New total'}
        </Label>
        <Input
          id="adj-amount"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          onFocus={(e) => e.currentTarget.select()}
          className="text-[16px]"
        />
        <p className="font-mono text-[10.5px] text-ink-500">
          Result: <span className="text-ink-900">{deriveResult(variant.stockCount, mode, amount)}</span>
        </p>
      </div>

      {/* Reason chips */}
      <div>
        <Label>Reason</Label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {REASON_CHIPS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setChangeType(r.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-caps transition',
                changeType === r.value
                  ? 'border-ink-900 bg-ink-900 text-snow'
                  : 'border-ink-200 bg-snow text-ink-700 hover:border-ink-900',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
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
  ) : null;

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      <Button onClick={submit} disabled={pending}>
        {pending ? 'Saving…' : 'Apply'}
      </Button>
    </>
  );

  return (
    <>
      {/* Desktop — right-side drawer */}
      <div className="hidden sm:block">
        <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
          <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Adjust stock</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">{body}</div>
            <SheetFooter>{footer}</SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile — bottom sheet */}
      <div className="sm:hidden">
        <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
          <SheetContent
            side="bottom"
            className="flex max-h-[92vh] flex-col rounded-t-2xl p-0 [&>button]:hidden"
          >
            <SheetHeader className="border-b border-ink-100 px-5 py-3">
              <SheetTitle>Adjust stock</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 py-4">{body}</div>
            <SheetFooter className="border-t border-ink-100 px-5 py-3 pb-[max(theme(spacing.3),env(safe-area-inset-bottom))]">
              {footer}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  mode: Mode;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-lg px-3 text-[12.5px] transition',
        active ? 'bg-ink-900 text-snow' : 'text-ink-500 hover:text-ink-900',
      )}
    >
      {children}
    </button>
  );
}

function deriveResult(current: number, mode: Mode, amount: string): string {
  const n = Number.parseInt(amount, 10);
  if (!Number.isFinite(n) || n < 0) return `${current}`;
  if (mode === 'add') return `${current} → ${current + n}`;
  if (mode === 'remove') return `${current} → ${Math.max(0, current - n)}`;
  return `${current} → ${n}`;
}
