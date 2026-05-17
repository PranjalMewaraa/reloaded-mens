'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle, UserRound } from 'lucide-react';
import { LEAD_STATUS, type LeadSummary } from '@repo/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';

interface Props {
  initial: LeadSummary[];
  currentStatus: string;
  currentSource: string;
  currentQ: string;
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: LEAD_STATUS.NEW, label: 'New' },
  { value: LEAD_STATUS.CONTACTED, label: 'Contacted' },
  { value: LEAD_STATUS.QUALIFIED, label: 'Qualified' },
  { value: LEAD_STATUS.CONVERTED, label: 'Converted' },
  { value: LEAD_STATUS.LOST, label: 'Lost' },
];

function statusTone(status: string): 'info' | 'warning' | 'success' | 'neutral' | 'danger' {
  switch (status) {
    case LEAD_STATUS.NEW:
      return 'info';
    case LEAD_STATUS.CONTACTED:
      return 'warning';
    case LEAD_STATUS.QUALIFIED:
      return 'warning';
    case LEAD_STATUS.CONVERTED:
      return 'success';
    case LEAD_STATUS.LOST:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function LeadsList({ initial, currentStatus, currentQ }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(currentQ);

  function switchParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === '') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    router.replace(`/leads?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    switchParam('q', search.trim());
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
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
        <form className="ml-auto flex gap-2" onSubmit={submitSearch}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / phone / email…"
            className="h-9 w-64"
          />
          <Button size="sm" type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-7 w-7" />}
          title="No leads in this view"
          description="Leads land here from the storefront /contact form. Meta Lead Ads webhook hooks up in Sprint 11."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {initial.map((lead) => {
            const waNumber = lead.phone?.replace(/[^0-9]/g, '');
            return (
              <li key={lead.id} className="rounded-2xl border border-ink-100 bg-snow p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-[14px] font-medium text-ink-900 hover:underline"
                      >
                        {lead.name ?? lead.email ?? lead.phone ?? '—'}
                      </Link>
                      <Pill tone="neutral">{lead.source.replace(/_/g, ' ')}</Pill>
                      <Pill tone={statusTone(lead.status)} withDot>
                        {lead.status}
                      </Pill>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-ink-500">
                      {lead.phone ? <span>{lead.phone}</span> : null}
                      {lead.email ? <span>{lead.email}</span> : null}
                      <span>{new Date(lead.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    {lead.message ? (
                      <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-700">
                        {lead.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {waNumber ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm">
                      <Link href={`/leads/${lead.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
