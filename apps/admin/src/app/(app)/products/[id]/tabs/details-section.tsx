'use client';

// Sprint 9 simplification — Description + Availability + Returnable into a
// single secondary card. These fields rarely need tweaking after creation, so
// they live below the primary blocks (images, pricing, variants, categories).

import { AVAILABILITY } from '@repo/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EditorProduct } from '../product-editor';

const AVAILABILITY_OPTIONS = [
  { v: AVAILABILITY.ONLINE_SHIPPABLE, title: 'Online' },
  { v: AVAILABILITY.IN_STORE_ONLY, title: 'In-store only' },
  { v: AVAILABILITY.BOTH, title: 'Both' },
];

interface DetailsSectionProps {
  draft: EditorProduct;
  patch: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void;
}

export function DetailsSection({ draft, patch }: DetailsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="b-desc">Description</Label>
          <Textarea
            id="b-desc"
            value={draft.description ?? ''}
            onChange={(e) => patch('description', e.target.value || null)}
            rows={5}
            placeholder="Customer-facing description. Plain text or basic Markdown."
          />
        </div>

        <div className="space-y-1.5">
          <Label>Availability</Label>
          <div className="inline-flex rounded-xl border border-ink-200 p-0.5">
            {AVAILABILITY_OPTIONS.map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => patch('availabilityFlag', opt.v)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] transition ${
                  draft.availabilityFlag === opt.v
                    ? 'bg-ink-900 text-snow'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {opt.title}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-ink-900">
          <input
            type="checkbox"
            checked={draft.isReturnable}
            onChange={(e) => patch('isReturnable', e.target.checked)}
            className="h-4 w-4 rounded border-ink-300"
          />
          Returnable — customers can request a return within the window.
        </label>
      </CardContent>
    </Card>
  );
}
