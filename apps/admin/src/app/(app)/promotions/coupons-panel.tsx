'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CouponSummary, PromotionDetail } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/ui/pill';
import {
  bulkGenerateCouponsAction,
  createCouponAction,
  deactivateCouponAction,
} from './actions';

interface Props {
  promotion: PromotionDetail;
}

export function CouponsPanel({ promotion }: Props) {
  const router = useRouter();
  const [coupons, setCoupons] = React.useState<CouponSummary[]>(promotion.coupons);

  // Single coupon form state
  const [code, setCode] = React.useState('');
  const [singleTotal, setSingleTotal] = React.useState(0);
  const [singlePerCustomer, setSinglePerCustomer] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  // Bulk form state
  const [bulkCount, setBulkCount] = React.useState(50);
  const [bulkPrefix, setBulkPrefix] = React.useState('');
  const [bulkLength, setBulkLength] = React.useState(10);
  const [bulkLabel, setBulkLabel] = React.useState('');
  const [bulkPerCustomer, setBulkPerCustomer] = React.useState(1);
  const [bulkTotal, setBulkTotal] = React.useState(1);
  const [bulking, setBulking] = React.useState(false);

  async function createOne() {
    if (!code.trim()) return;
    setCreating(true);
    const res = await createCouponAction(promotion.id, {
      code: code.trim().toUpperCase(),
      usageLimitTotal: singleTotal,
      usageLimitPerCustomer: singlePerCustomer,
    });
    setCreating(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Failed to create coupon');
      return;
    }
    toast.success(`Coupon ${res.data.code} created`);
    setCode('');
    setCoupons((prev) => [res.data!, ...prev]);
  }

  async function runBulk() {
    setBulking(true);
    const res = await bulkGenerateCouponsAction(promotion.id, {
      count: bulkCount,
      prefix: bulkPrefix.trim() || undefined,
      length: bulkLength,
      batchLabel: bulkLabel.trim() || undefined,
      usageLimitTotal: bulkTotal,
      usageLimitPerCustomer: bulkPerCustomer,
    });
    setBulking(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Bulk generation failed');
      return;
    }
    toast.success(`Generated ${res.data.generated.length} coupons`);
    setCoupons((prev) => [...res.data!.generated, ...prev]);
    downloadCsv(
      `${promotion.name.toLowerCase().replace(/\W+/g, '-')}-${bulkLabel || Date.now()}.csv`,
      res.data.generated,
    );
  }

  async function deactivate(couponId: string, codeStr: string) {
    if (!confirm(`Deactivate ${codeStr}?`)) return;
    const res = await deactivateCouponAction(promotion.id, couponId);
    if (!res.ok) {
      toast.error(res.error ?? 'Failed');
      return;
    }
    toast.success(`${codeStr} deactivated`);
    setCoupons((prev) => prev.map((c) => (c.id === couponId ? { ...c, isActive: false } : c)));
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-md border border-ink-100 p-4">
        <h3 className="text-[13px] font-semibold text-ink-900">Add single coupon</h3>
        <p className="mt-1 text-[11px] text-ink-500">For hand-picked codes like WELCOME200.</p>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME200"
              maxLength={40}
              className="font-mono uppercase tracking-caps"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Total uses (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                value={singleTotal}
                onChange={(e) => setSingleTotal(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label>Per customer</Label>
              <Input
                type="number"
                min={0}
                value={singlePerCustomer}
                onChange={(e) => setSinglePerCustomer(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <Button size="sm" onClick={createOne} disabled={creating || code.trim().length === 0}>
            {creating ? 'Creating…' : 'Create coupon'}
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-ink-100 p-4">
        <h3 className="text-[13px] font-semibold text-ink-900">Bulk generate</h3>
        <p className="mt-1 text-[11px] text-ink-500">
          Generate up to 1000 random codes. Downloads as CSV when done.
        </p>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Count</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
              />
            </div>
            <div>
              <Label>Code length</Label>
              <Input
                type="number"
                min={6}
                max={16}
                value={bulkLength}
                onChange={(e) => setBulkLength(Math.max(6, Math.min(16, Number(e.target.value) || 10)))}
              />
            </div>
          </div>
          <div>
            <Label>Prefix (optional)</Label>
            <Input
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="INFLU"
              className="font-mono uppercase"
            />
          </div>
          <div>
            <Label>Batch label (optional)</Label>
            <Input
              value={bulkLabel}
              onChange={(e) => setBulkLabel(e.target.value)}
              placeholder="launch-influencers"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Total uses each</Label>
              <Input
                type="number"
                min={0}
                value={bulkTotal}
                onChange={(e) => setBulkTotal(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label>Per customer</Label>
              <Input
                type="number"
                min={0}
                value={bulkPerCustomer}
                onChange={(e) => setBulkPerCustomer(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <Button size="sm" onClick={runBulk} disabled={bulking}>
            {bulking ? 'Generating…' : `Generate ${bulkCount} codes`}
          </Button>
        </div>
      </section>

      <section className="md:col-span-2 rounded-md border border-ink-100 p-4">
        <h3 className="text-[13px] font-semibold text-ink-900">Existing coupons</h3>
        {coupons.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-500">No coupons yet.</p>
        ) : (
          <table className="mt-3 w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-ink-100 text-left text-[10.5px] font-mono uppercase tracking-caps text-ink-500">
                <th className="py-1">Code</th>
                <th>Batch</th>
                <th>Used</th>
                <th>Total cap</th>
                <th>Per-customer</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-ink-50 last:border-b-0">
                  <td className="py-1.5 font-mono text-ink-900">{c.code}</td>
                  <td className="text-ink-500">{c.batchLabel ?? '—'}</td>
                  <td>{c.usageCount}</td>
                  <td>{c.usageLimitTotal === 0 ? '∞' : c.usageLimitTotal}</td>
                  <td>{c.usageLimitPerCustomer === 0 ? '∞' : c.usageLimitPerCustomer}</td>
                  <td>
                    <Pill tone={c.isActive ? 'success' : 'neutral'} withDot>
                      {c.isActive ? 'Active' : 'Off'}
                    </Pill>
                  </td>
                  <td className="text-right">
                    {c.isActive ? (
                      <Button size="sm" variant="ghost" onClick={() => deactivate(c.id, c.code)}>
                        Deactivate
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function downloadCsv(filename: string, coupons: CouponSummary[]) {
  const header = 'code,batchLabel,usageLimitTotal,usageLimitPerCustomer\n';
  const body = coupons
    .map((c) => [c.code, c.batchLabel ?? '', c.usageLimitTotal, c.usageLimitPerCustomer].join(','))
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
