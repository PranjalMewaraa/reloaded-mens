'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { INVENTORY_CHANGE_TYPE, type StockAdjustInput } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChipInput } from '@/components/ui/chip-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { VariantMatrix } from '@/components/products/variant-matrix';
import {
  adjustVariantStockAction,
  createVariantMatrixAction,
  deleteVariantAction,
  updateVariantAction,
} from '../actions';

export interface EditorVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  priceOverridePaisa: number | null;
  stockCount: number;
  lowStockThreshold: number;
  isActive: boolean;
  barcode: string | null;
}

interface VariantsTabProps {
  productId: string;
  variants: EditorVariant[];
}

export function VariantsTab({ productId, variants }: VariantsTabProps) {
  const router = useRouter();
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState<EditorVariant | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Phase 2a — inline stock entry. Matrix cells call back here with the
  // new absolute stock count; we diff against current to write an
  // InventoryEvent with a sensible default changeType. The legacy
  // AdjustDrawer is still reachable from the "Adjust with note" link below
  // for the audit-heavy path.
  async function handleInlineStockSet(v: { id: string; stockCount: number }, next: number) {
    const delta = next - v.stockCount;
    if (delta === 0) return;
    const changeType =
      delta > 0 ? INVENTORY_CHANGE_TYPE.RESTOCK : INVENTORY_CHANGE_TYPE.CORRECTION;
    const result = await adjustVariantStockAction(v.id, productId, {
      delta,
      changeType,
    });
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to update stock');
      router.refresh(); // Re-sync so the cell snaps back to server truth.
      return;
    }
    toast.success(`Stock set to ${next}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[16px]">Variant matrix</CardTitle>
          <Button size="sm" onClick={() => setMatrixOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Generate matrix
          </Button>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-[13px] text-ink-500">
              No variants yet. Generate the matrix with the size and colour axes you carry.
            </p>
          ) : (
            <>
              <VariantMatrix
                variants={variants}
                onInlineStockSet={handleInlineStockSet}
                onCellClick={(v) => setAdjusting(variants.find((x) => x.id === v.id) ?? null)}
              />
              <p className="mt-3 text-[11.5px] text-ink-500">
                Tap a cell to set stock directly. For damage / correction notes,{' '}
                <button
                  type="button"
                  onClick={() => setAdjusting(variants[0] ?? null)}
                  className="text-ink-700 underline-offset-2 hover:underline"
                >
                  open the adjust drawer
                </button>
                .
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {variants.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[16px]">Per-variant overrides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="label-caps grid grid-cols-[minmax(0,2fr)_1fr_1fr_0.7fr_44px] items-center gap-3 px-3 text-ink-500">
              <div>SKU</div>
              <div>Override (₹)</div>
              <div>Low stock</div>
              <div>Active</div>
              <div />
            </div>
            {variants.map((v) => (
              <VariantRow
                key={v.id}
                productId={productId}
                variant={v}
                disabled={pending}
                onAfterChange={() => router.refresh()}
                onDelete={() =>
                  startTransition(async () => {
                    const result = await deleteVariantAction(v.id, productId);
                    if (!result.ok) {
                      toast.error(result.error ?? 'Delete failed');
                      return;
                    }
                    toast.success('Variant deleted');
                    router.refresh();
                  })
                }
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <MatrixDialog
        open={matrixOpen}
        productId={productId}
        onClose={() => setMatrixOpen(false)}
        onCreated={() => {
          setMatrixOpen(false);
          router.refresh();
        }}
      />

      <AdjustDrawer
        variant={adjusting}
        productId={productId}
        onClose={() => setAdjusting(null)}
        onSaved={() => {
          setAdjusting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

// =====================================================
// Per-variant override row
// =====================================================

function VariantRow({
  variant,
  productId,
  onAfterChange,
  onDelete,
  disabled,
}: {
  variant: EditorVariant;
  productId: string;
  onAfterChange: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [override, setOverride] = React.useState(
    variant.priceOverridePaisa != null ? String(variant.priceOverridePaisa / 100) : '',
  );
  const [lowStock, setLowStock] = React.useState(String(variant.lowStockThreshold));
  const [active, setActive] = React.useState(variant.isActive);
  const [saving, setSaving] = React.useState(false);

  const dirty =
    override !== (variant.priceOverridePaisa != null ? String(variant.priceOverridePaisa / 100) : '') ||
    lowStock !== String(variant.lowStockThreshold) ||
    active !== variant.isActive;

  async function persist() {
    setSaving(true);
    try {
      const paisa = override === '' ? null : Math.round(parseFloat(override) * 100);
      if (paisa !== null && (!Number.isFinite(paisa) || paisa < 0)) {
        toast.error('Override must be a non-negative number');
        return;
      }
      const result = await updateVariantAction(variant.id, productId, {
        priceOverridePaisa: paisa,
        lowStockThreshold: Number.parseInt(lowStock, 10) || 0,
        isActive: active,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success('Variant updated');
      onAfterChange();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_0.7fr_44px] items-center gap-3 rounded-md border border-ink-100 bg-snow px-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-mono text-[12.5px] text-ink-900">{variant.sku}</div>
        <div className="text-[10.5px] text-ink-500">
          {[variant.size, variant.color].filter(Boolean).join(' · ') || 'No axis'}
        </div>
      </div>
      <Input
        value={override}
        type="number"
        min="0"
        step="0.01"
        placeholder="—"
        onChange={(e) => setOverride(e.target.value)}
        className="h-9 text-[12.5px]"
        disabled={disabled || saving}
      />
      <Input
        value={lowStock}
        type="number"
        min="0"
        onChange={(e) => setLowStock(e.target.value)}
        className="h-9 text-[12.5px]"
        disabled={disabled || saving}
      />
      <label className="flex items-center gap-2 text-[12.5px] text-ink-900">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300"
          disabled={disabled || saving}
        />
        Active
      </label>
      <div className="flex items-center justify-end gap-1">
        {dirty ? (
          <Button size="sm" onClick={persist} disabled={saving} className="h-8 px-2">
            {saving ? '…' : 'Save'}
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            disabled={disabled || saving}
            aria-label="Delete variant"
            className="h-8 w-8 text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Matrix generator dialog
//
// Phase 2a — chip input + preset rows. Comma-separated text was painful on
// mobile keyboards; chip input + preset taps gets sizes + colours in 3-4 taps.
// Phase 2c — renders as a bottom sheet on mobile (slide-up), centered Dialog
// on desktop. Same component switches at the `sm` breakpoint via the Sheet
// vs Dialog primitive.
// =====================================================

const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38'];
const COLOUR_PRESETS = ['Black', 'White', 'Natural', 'Olive', 'Navy', 'Brown', 'Beige', 'Charcoal'];

function MatrixDialog({
  open,
  productId,
  onClose,
  onCreated,
}: {
  open: boolean;
  productId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sizes, setSizes] = React.useState<string[]>([]);
  const [colors, setColors] = React.useState<string[]>([]);
  const [prefix, setPrefix] = React.useState('');
  const [stockCount, setStockCount] = React.useState('0');
  const [lowStockThreshold, setLowStockThreshold] = React.useState('3');
  const [pending, startTransition] = React.useTransition();

  // Reset state every time the dialog reopens so a half-filled generate doesn't
  // bleed across two products.
  React.useEffect(() => {
    if (open) {
      setSizes([]);
      setColors([]);
      setPrefix('');
      setStockCount('0');
      setLowStockThreshold('3');
    }
  }, [open]);

  function submit() {
    if (sizes.length === 0 && colors.length === 0) {
      toast.error('Add at least one size or colour');
      return;
    }
    if (!prefix.trim()) {
      toast.error('SKU prefix is required');
      return;
    }
    startTransition(async () => {
      const result = await createVariantMatrixAction(productId, {
        axes: {
          ...(sizes.length > 0 ? { size: sizes } : {}),
          ...(colors.length > 0 ? { color: colors } : {}),
        },
        skuPrefix: prefix.toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/-+/g, '-'),
        defaults: {
          stockCount: Number.parseInt(stockCount, 10) || 0,
          lowStockThreshold: Number.parseInt(lowStockThreshold, 10) || 3,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Generate failed');
        return;
      }
      toast.success('Matrix generated');
      onCreated();
    });
  }

  const totalCells = Math.max(sizes.length, 1) * Math.max(colors.length, 1);

  const body = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="m-sku">SKU prefix</Label>
        <Input
          id="m-sku"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="RLD-CAMP"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono uppercase tracking-caps"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Sizes</Label>
        <ChipInput
          values={sizes}
          onChange={setSizes}
          presets={SIZE_PRESETS}
          normalize={(t) => t.toUpperCase().trim()}
          placeholder="Type and press Enter"
          autoCapitalize="characters"
          ariaLabel="Sizes"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Colours</Label>
        <ChipInput
          values={colors}
          onChange={setColors}
          presets={COLOUR_PRESETS}
          normalize={(t) => t.trim().replace(/\b\w/g, (c) => c.toUpperCase())}
          placeholder="Type and press Enter"
          autoCapitalize="words"
          ariaLabel="Colours"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="m-stock">Initial stock</Label>
          <Input
            id="m-stock"
            value={stockCount}
            onChange={(e) => setStockCount(e.target.value)}
            type="number"
            inputMode="numeric"
            min="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-low">Low-stock threshold</Label>
          <Input
            id="m-low"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            type="number"
            inputMode="numeric"
            min="0"
          />
        </div>
      </div>
      <p className="text-[12px] text-ink-500">
        Will create {totalCells} variant{totalCells === 1 ? '' : 's'}. Skips any (size, colour) pair
        already on this product — safe to re-run.
      </p>
    </div>
  );

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      <Button onClick={submit} disabled={pending}>
        {pending ? 'Generating…' : 'Generate'}
      </Button>
    </>
  );

  return (
    <>
      {/* Desktop — centered dialog */}
      <div className="hidden sm:block">
        <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate variant matrix</DialogTitle>
            </DialogHeader>
            {body}
            <DialogFooter>{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile — bottom sheet (slide up). Sheet primitive's `bottom` side
          gives us the iOS-native feel without inventing a new modal type. */}
      <div className="sm:hidden">
        <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
          <SheetContent
            side="bottom"
            className="flex max-h-[90vh] flex-col rounded-t-2xl p-0 [&>button]:hidden"
          >
            <SheetHeader className="border-b border-ink-100 px-5 py-3">
              <SheetTitle>Generate variant matrix</SheetTitle>
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

// =====================================================
// Stock adjust drawer (used inline from a matrix cell click)
// =====================================================

function AdjustDrawer({
  variant,
  productId,
  onClose,
  onSaved,
}: {
  variant: EditorVariant | null;
  productId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
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
      const result = await adjustVariantStockAction(variant.id, productId, payload);
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
