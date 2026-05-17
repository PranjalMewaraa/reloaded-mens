'use client';

import { AVAILABILITY } from '@repo/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EditorProduct } from '../product-editor';

interface AvailabilityTabProps {
  draft: EditorProduct;
  patch: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void;
}

const OPTIONS = [
  {
    v: AVAILABILITY.ONLINE_SHIPPABLE,
    title: 'Online shippable',
    desc: 'Visible on storefront, ships nationwide.',
  },
  {
    v: AVAILABILITY.IN_STORE_ONLY,
    title: 'In-store only',
    desc: 'Not listed on storefront. Stock decremented from store sales.',
  },
  {
    v: AVAILABILITY.BOTH,
    title: 'Both',
    desc: 'Shows online and counts towards in-store inventory.',
  },
];

export function AvailabilityTab({ draft, patch }: AvailabilityTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">Availability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPTIONS.map((opt) => (
            <label
              key={opt.v}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-[13px] ${
                draft.availabilityFlag === opt.v
                  ? 'border-ink-900 bg-ink-50/60'
                  : 'border-ink-200 hover:bg-ink-50/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="availability"
                  className="h-4 w-4"
                  checked={draft.availabilityFlag === opt.v}
                  onChange={() => patch('availabilityFlag', opt.v)}
                />
                <span className="font-medium text-ink-900">{opt.title}</span>
              </div>
              <p className="text-[12px] text-ink-500">{opt.desc}</p>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-[13px] text-ink-900">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => patch('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-ink-300"
            />
            Active (visible on storefront)
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-900">
            <input
              type="checkbox"
              checked={draft.isReturnable}
              onChange={(e) => patch('isReturnable', e.target.checked)}
              className="h-4 w-4 rounded border-ink-300"
            />
            Returnable
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
