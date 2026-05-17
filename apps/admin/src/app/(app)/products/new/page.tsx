'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AVAILABILITY } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shell/page-header';
import { createProductAction } from '../actions';

const GST_RATES = [0, 5, 12, 18, 28] as const;

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugDirty, setSlugDirty] = React.useState(false);
  const [basePriceRupees, setBasePriceRupees] = React.useState('');
  const [gstRate, setGstRate] = React.useState<number>(12);
  const [availability, setAvailability] = React.useState<string>(AVAILABILITY.ONLINE_SHIPPABLE);
  const [pending, startTransition] = React.useTransition();

  function handleNameChange(v: string) {
    setName(v);
    if (!slugDirty) setSlug(slugify(v));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const paisa = Math.round(parseFloat(basePriceRupees || '0') * 100);
    if (!Number.isFinite(paisa) || paisa < 0) {
      toast.error('Enter a valid base price');
      return;
    }
    startTransition(async () => {
      const result = await createProductAction({
        slug,
        name,
        basePricePaisa: paisa,
        gstRatePercent: gstRate,
        availabilityFlag: availability as (typeof AVAILABILITY)[keyof typeof AVAILABILITY],
        isActive: true,
        isReturnable: true,
      });
      if (!result.ok || !result.data) {
        toast.error(result.error ?? 'Create failed');
        return;
      }
      toast.success('Product created');
      router.replace(`/products/${result.data.id}`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Catalogue' },
          { label: 'Products', href: '/products' },
          { label: 'New' },
        ]}
        title="New product"
        description="Create the basics. You can add variants, images, and categories on the next screen."
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <form onSubmit={submit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-[16px]">Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Reloaded Camp Shirt"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-slug">Slug</Label>
                <Input
                  id="p-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugDirty(true);
                  }}
                  placeholder="mool-camp-shirt"
                  required
                />
                <p className="font-mono text-[10.5px] text-ink-500">/products/{slug || 'slug'}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-price">Base price (₹)</Label>
                  <Input
                    id="p-price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={basePriceRupees}
                    onChange={(e) => setBasePriceRupees(e.target.value)}
                    placeholder="1999"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-gst">GST rate</Label>
                  <select
                    id="p-gst"
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Availability</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {[
                    { v: AVAILABILITY.ONLINE_SHIPPABLE, l: 'Online shippable' },
                    { v: AVAILABILITY.IN_STORE_ONLY, l: 'In-store only' },
                    { v: AVAILABILITY.BOTH, l: 'Both' },
                  ].map((opt) => (
                    <label
                      key={opt.v}
                      className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] ${
                        availability === opt.v
                          ? 'border-ink-900 bg-ink-50/60 text-ink-900'
                          : 'border-ink-200 text-ink-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="avail"
                        value={opt.v}
                        checked={availability === opt.v}
                        onChange={() => setAvailability(opt.v)}
                        className="h-4 w-4"
                      />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.replace('/products')}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name || !slug || !basePriceRupees}>
              {pending ? 'Creating…' : 'Create & continue'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
