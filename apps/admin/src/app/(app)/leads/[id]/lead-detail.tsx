'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LEAD_STATUS, type LeadSummary } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { deleteLeadAction, updateLeadAction } from '../actions';

const STATUS_OPTIONS = [
  { value: LEAD_STATUS.NEW, label: 'New' },
  { value: LEAD_STATUS.CONTACTED, label: 'Contacted' },
  { value: LEAD_STATUS.QUALIFIED, label: 'Qualified' },
  { value: LEAD_STATUS.CONVERTED, label: 'Converted' },
  { value: LEAD_STATUS.LOST, label: 'Lost' },
];

interface Props {
  initial: LeadSummary;
}

export function LeadDetail({ initial }: Props) {
  const router = useRouter();
  const [lead, setLead] = React.useState(initial);
  const [status, setStatus] = React.useState(initial.status);
  const [note, setNote] = React.useState(initial.internalNote ?? '');
  const [saving, setSaving] = React.useState(false);

  const waNumber = lead.phone?.replace(/[^0-9]/g, '');

  async function save() {
    setSaving(true);
    const res = await updateLeadAction(lead.id, {
      status: status === lead.status ? undefined : (status as typeof STATUS_OPTIONS[number]['value']),
      internalNote: note === (lead.internalNote ?? '') ? undefined : note,
    });
    setSaving(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Failed to save');
      return;
    }
    setLead(res.data);
    toast.success('Lead updated');
    router.refresh();
  }

  async function remove() {
    if (!confirm('Delete this lead permanently?')) return;
    const res = await deleteLeadAction(lead.id);
    if (!res.ok) {
      toast.error(res.error ?? 'Failed to delete');
      return;
    }
    toast.success('Lead deleted');
    router.push('/leads');
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="md:col-span-2 space-y-4">
        <div className="rounded-2xl border border-ink-100 bg-snow p-5">
          <h3 className="text-[13px] font-semibold text-ink-900">Contact</h3>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Name</dt>
              <dd className="text-ink-900">{lead.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Phone</dt>
              <dd className="font-mono text-ink-900">{lead.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Email</dt>
              <dd className="text-ink-900">{lead.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Source</dt>
              <dd className="text-ink-900">{lead.source.replace(/_/g, ' ')}</dd>
            </div>
          </dl>
          {lead.message ? (
            <div className="mt-4">
              <dt className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Message</dt>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-ink-100 bg-ink-50 p-3 text-[12.5px] text-ink-900">
                {lead.message}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-ink-100 bg-snow p-5">
          <h3 className="text-[13px] font-semibold text-ink-900">Internal note</h3>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="What was discussed, next steps, etc."
            className="mt-3"
          />
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-ink-100 bg-snow p-5">
          <h3 className="text-[13px] font-semibold text-ink-900">Status</h3>
          <div className="mt-3 space-y-3">
            <Pill tone="info" withDot>{lead.status}</Pill>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="w-full" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>

        {waNumber ? (
          <div className="rounded-2xl border border-ink-100 bg-snow p-5">
            <h3 className="text-[13px] font-semibold text-ink-900">Reach out</h3>
            <Button asChild size="sm" variant="outline" className="mt-3 w-full">
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                Open WhatsApp
              </a>
            </Button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-ink-100 bg-snow p-5">
          <h3 className="text-[13px] font-semibold text-ink-900">Danger zone</h3>
          <Button size="sm" variant="ghost" className="mt-2 w-full text-danger" onClick={remove}>
            Delete lead
          </Button>
        </div>
      </aside>
    </div>
  );
}
