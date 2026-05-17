'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/ui/pill';
import type { EditorProduct } from '../product-editor';

const GST_RATES = [0, 5, 12, 18, 28] as const;

interface GstTabProps {
  draft: EditorProduct;
  patch: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void;
}

export function GstTab({ draft, patch }: GstTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">Tax & cost</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gst-hsn">HSN code</Label>
            <Input
              id="gst-hsn"
              value={draft.hsnCode ?? ''}
              onChange={(e) => patch('hsnCode', e.target.value || null)}
              placeholder="6105"
            />
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
          </div>
        </div>
        <div className="rounded-xl bg-ink-50 px-3 py-3 text-[12.5px] text-ink-500">
          <Pill tone="warning" className="mr-2">
            Admin only
          </Pill>
          Cost price is hidden from customer-facing surfaces and not used by checkout. Set it
          on the Basics tab for margin tracking only.
        </div>
      </CardContent>
    </Card>
  );
}
