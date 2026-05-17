'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EditorProduct } from '../product-editor';

interface BasicsTabProps {
  draft: EditorProduct;
  patch: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void;
}

export function BasicsTab({ draft, patch }: BasicsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">Basics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input
              id="b-name"
              value={draft.name}
              onChange={(e) => patch('name', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-slug">Slug</Label>
            <Input
              id="b-slug"
              value={draft.slug}
              onChange={(e) => patch('slug', e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-desc">Description</Label>
          <Textarea
            id="b-desc"
            value={draft.description ?? ''}
            onChange={(e) => patch('description', e.target.value || null)}
            rows={6}
            placeholder="Customer-facing description. Plain text or basic Markdown."
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-base">Base price (paisa)</Label>
            <Input
              id="b-base"
              type="number"
              min="0"
              step="1"
              value={draft.basePricePaisa}
              onChange={(e) => patch('basePricePaisa', Number(e.target.value))}
            />
            <p className="font-mono text-[10.5px] text-ink-500">
              ₹{(draft.basePricePaisa / 100).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-mrp">MRP (paisa)</Label>
            <Input
              id="b-mrp"
              type="number"
              min="0"
              step="1"
              value={draft.compareAtPricePaisa ?? ''}
              onChange={(e) =>
                patch(
                  'compareAtPricePaisa',
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
              placeholder="Optional"
            />
            <p className="font-mono text-[10.5px] text-ink-500">
              {draft.compareAtPricePaisa
                ? `₹${(draft.compareAtPricePaisa / 100).toLocaleString('en-IN')}`
                : '—'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-cost">Cost (paisa)</Label>
            <Input
              id="b-cost"
              type="number"
              min="0"
              step="1"
              value={draft.costPricePaisa ?? ''}
              onChange={(e) =>
                patch(
                  'costPricePaisa',
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
              placeholder="Admin only"
            />
            <p className="font-mono text-[10.5px] text-ink-500">
              {draft.costPricePaisa
                ? `₹${(draft.costPricePaisa / 100).toLocaleString('en-IN')}`
                : '—'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
