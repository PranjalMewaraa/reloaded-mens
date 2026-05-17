'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Percent } from 'lucide-react';
import { toast } from 'sonner';
import type { PromotionSummary } from '@repo/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { deletePromotionAction } from './actions';

interface Props {
  initial: PromotionSummary[];
  currentStatus: string;
  currentType: string;
  currentQ: string;
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const TYPE_TABS = [
  { value: 'all', label: 'All types' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'coupon', label: 'Coupon-gated' },
];

export function PromotionsList({ initial, currentStatus, currentType, currentQ }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(currentQ);

  function switchParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === '') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    router.replace(`/promotions?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    switchParam('q', search.trim());
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete or deactivate "${name}"?`)) return;
    const res = await deletePromotionAction(id);
    if (!res.ok) {
      toast.error(res.error ?? 'Failed to delete');
      return;
    }
    toast.success('Promotion removed');
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={currentStatus === t.value ? 'default' : 'outline'}
              onClick={() => switchParam('status', t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {TYPE_TABS.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={currentType === t.value ? 'default' : 'outline'}
              onClick={() => switchParam('type', t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <form className="ml-auto flex gap-2" onSubmit={submitSearch}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name…"
            className="h-9 w-56"
          />
          <Button size="sm" type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-7 w-7" />}
          title="No promotions yet"
          description="Create your first promotion to unlock automatic discounts and coupon drops."
          action={
            <Button asChild>
              <Link href="/promotions/new">+ New promotion</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {initial.map((p) => (
            <li key={p.id} className="rounded-2xl border border-ink-100 bg-snow p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/promotions/${p.id}`}
                      className="text-[14px] font-medium text-ink-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <Pill tone={p.isAutomatic ? 'info' : 'neutral'}>
                      {p.isAutomatic ? 'Automatic' : 'Coupon'}
                    </Pill>
                    <Pill tone={p.isActive ? 'success' : 'neutral'} withDot>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Pill>
                    {p.stackable ? <Pill tone="neutral">Stackable</Pill> : null}
                  </div>
                  {p.description ? (
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-500">{p.description}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    <span>{p.couponCount} coupon{p.couponCount === 1 ? '' : 's'}</span>
                    <span>Used {p.usageCount}×</span>
                    {p.validFrom || p.validTo ? (
                      <span>
                        {p.validFrom ? new Date(p.validFrom).toLocaleDateString('en-IN') : '—'} →{' '}
                        {p.validTo ? new Date(p.validTo).toLocaleDateString('en-IN') : '—'}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/promotions/${p.id}`}>Open</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(p.id, p.name)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
