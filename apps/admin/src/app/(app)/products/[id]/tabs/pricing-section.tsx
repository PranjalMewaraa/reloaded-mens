'use client';

// Sprint 9 simplification — Pricing + GST + HSN merged into a single section so
// the operator never has to tab-hunt for tax classification while setting price.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/ui/pill';
import type { EditorProduct } from '../product-editor';

const GST_RATES = [0, 5, 12, 18, 28] as const;

interface PricingSectionProps {
  draft: EditorProduct;
  patch: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void;
}

// Convert the paisa integer in state to a rupees-string the operator types. We
// keep paisa as the canonical unit on EditorProduct so the existing SaveBar diff
// keeps working without conversion gymnastics.
function paisaToRupees(p: number | null | undefined): string {
  if (p === null || p === undefined) return '';
  return String(p / 100);
}

function rupeesToPaisa(s: string): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function PricingSection({ draft, patch }: PricingSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-[16px]">Pricing & tax</CardTitle>
        <Pill tone="neutral">Customer pays {paisaToRupees(draft.basePricePaisa) ? `₹${paisaToRupees(draft.basePricePaisa)}` : '—'}</Pill>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-base">Price (₹)</Label>
            <Input
              id="b-base"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paisaToRupees(draft.basePricePaisa)}
              onChange={(e) => patch('basePricePaisa', rupeesToPaisa(e.target.value))}
              placeholder="1999"
            />
            <p className="font-mono text-[10.5px] text-ink-500">What the customer pays.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-mrp">MRP (₹)</Label>
            <Input
              id="b-mrp"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paisaToRupees(draft.compareAtPricePaisa)}
              onChange={(e) =>
                patch(
                  'compareAtPricePaisa',
                  e.target.value === '' ? null : rupeesToPaisa(e.target.value),
                )
              }
              placeholder="Optional"
            />
            <p className="font-mono text-[10.5px] text-ink-500">Shown struck-through.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-cost">Cost (₹)</Label>
            <Input
              id="b-cost"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paisaToRupees(draft.costPricePaisa)}
              onChange={(e) =>
                patch(
                  'costPricePaisa',
                  e.target.value === '' ? null : rupeesToPaisa(e.target.value),
                )
              }
              placeholder="Admin only"
            />
            <p className="font-mono text-[10.5px] text-ink-500">Margin tracking, never shown.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gst-hsn">HSN code</Label>
            <Input
              id="gst-hsn"
              value={draft.hsnCode ?? ''}
              onChange={(e) => patch('hsnCode', e.target.value || null)}
              placeholder="6105"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
            />
            <p className="font-mono text-[10.5px] text-ink-500">Required for GST invoice.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gst-rate">GST rate</Label>
            <select
              id="gst-rate"
              value={draft.gstRatePercent ?? ''}
              onChange={(e) =>
                patch('gstRatePercent', e.target.value === '' ? null : Number(e.target.value))
              }
              className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
            >
              <option value="">Not set</option>
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
            <p className="font-mono text-[10.5px] text-ink-500">Inclusive of price.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
