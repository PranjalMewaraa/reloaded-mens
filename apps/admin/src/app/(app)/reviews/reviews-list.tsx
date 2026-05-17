'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { REVIEW_STATUS, type AdminReviewSummary } from '@repo/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { Textarea } from '@/components/ui/textarea';
import { approveReviewAction, rejectReviewAction } from './actions';

const TABS = [
  { value: REVIEW_STATUS.PENDING, label: 'Pending' },
  { value: REVIEW_STATUS.APPROVED, label: 'Approved' },
  { value: REVIEW_STATUS.REJECTED, label: 'Rejected' },
  { value: 'all', label: 'All' },
];

interface Props {
  initial: AdminReviewSummary[];
  currentStatus: string;
}

export function ReviewsList({ initial, currentStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = React.useState(initial);
  const [rejectTarget, setRejectTarget] = React.useState<AdminReviewSummary | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setRows(initial);
  }, [initial]);

  function switchTab(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'pending') next.delete('status');
    else next.set('status', value);
    next.delete('page');
    router.replace(`/reviews?${next.toString()}`);
  }

  async function approve(id: string) {
    setBusy(true);
    const res = await approveReviewAction(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Failed to approve');
      return;
    }
    toast.success('Review approved');
    setRows((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setBusy(true);
    const res = await rejectReviewAction(rejectTarget.id, rejectReason.trim());
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Failed to reject');
      return;
    }
    toast.success('Review rejected');
    setRows((prev) => prev.filter((r) => r.id !== rejectTarget.id));
    setRejectTarget(null);
    setRejectReason('');
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={currentStatus === t.value ? 'default' : 'outline'}
            onClick={() => switchTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Star className="h-7 w-7" />}
          title="Nothing in this tab"
          description="Reviews land here from the post-delivery email links."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-ink-100 bg-snow p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="text-[14px] font-medium text-ink-900">{r.title}</span>
                    <Pill tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'} withDot>
                      {r.status}
                    </Pill>
                  </div>
                  <p className="mt-1 line-clamp-3 text-[13px] text-ink-700">{r.body}</p>
                  <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    <span>{r.authorName}</span>
                    <Link href={`/p/${r.productSlug}`} target="_blank" className="hover:underline">
                      {r.productName}
                    </Link>
                    <Link href={`/orders/${r.orderNumber}`} className="hover:underline">
                      {r.orderNumber}
                    </Link>
                    <span>{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  {r.rejectedReason ? (
                    <p className="mt-1 text-[12px] text-danger">Reject reason: {r.rejectedReason}</p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  {r.status !== 'approved' ? (
                    <Button size="sm" onClick={() => approve(r.id)} disabled={busy}>
                      Approve
                    </Button>
                  ) : null}
                  {r.status !== 'rejected' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejectTarget(r);
                        setRejectReason('');
                      }}
                      disabled={busy}
                    >
                      Reject
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject review</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-ink-500">
            Required — the reason is stored on the review and visible to other admins.
          </p>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Off-topic / spam / language…"
            rows={3}
            className="mt-2"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReject} disabled={busy || rejectReason.trim().length < 3}>
              {busy ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            'h-3.5 w-3.5 ' +
            (n <= value ? 'fill-clay text-clay' : 'fill-ink-100 text-ink-200')
          }
        />
      ))}
    </span>
  );
}
