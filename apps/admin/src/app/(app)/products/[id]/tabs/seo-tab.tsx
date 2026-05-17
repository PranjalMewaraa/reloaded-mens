'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EditorProduct } from '../product-editor';

interface SeoTabProps {
  draft: EditorProduct;
  patch: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void;
}

export function SeoTab({ draft, patch }: SeoTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[16px]">SEO</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="seo-title">SEO title</Label>
          <Input
            id="seo-title"
            value={draft.seoTitle ?? ''}
            maxLength={120}
            onChange={(e) => patch('seoTitle', e.target.value || null)}
            placeholder={draft.name}
          />
          <p className="font-mono text-[10.5px] text-ink-500">
            {(draft.seoTitle ?? '').length} / 120
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seo-desc">SEO description</Label>
          <Textarea
            id="seo-desc"
            value={draft.seoDescription ?? ''}
            maxLength={320}
            onChange={(e) => patch('seoDescription', e.target.value || null)}
            rows={3}
          />
          <p className="font-mono text-[10.5px] text-ink-500">
            {(draft.seoDescription ?? '').length} / 320
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seo-og">OG image URL</Label>
          <Input
            id="seo-og"
            value={draft.ogImageUrl ?? ''}
            onChange={(e) => patch('ogImageUrl', e.target.value || null)}
            placeholder="https://…"
          />
          <p className="font-mono text-[10.5px] text-ink-500">
            Optional — defaults to the primary product image.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
