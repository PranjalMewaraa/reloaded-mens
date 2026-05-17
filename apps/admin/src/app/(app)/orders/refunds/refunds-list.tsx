'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/ui/pill';
import { Textarea } from '@/components/ui/textarea';
import { approveRefundAction, rejectRefundAction } from '../[id]/actions';

export interface RefundListItem {
  id: string;
  refundNumber: string;
  orderId: string;
  orderNumber: string;
  status: string;
  amountPaisa: number;
  reason: string;
  rejectedReason: string | null;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

const TABS: Array<{ value: string; label: string }> = [
  { value: 'pending_admin_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

interface Props {
  initial: RefundListItem[];
  currentStatus: string;
}

export function RefundsList({ initial, currentStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rejectTarget, setRejectTarget] = React.useState<RefundListItem | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function switchTab(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('status', value);
    next.delete('page');
    router.replace(`/orders/refunds?${next.toString()}`);
  }

  function approve(refund: RefundListItem) {
    if (typeof window !== 'undefined' && !window.confirm(`Approve refund ${refund.refundNumber}?`)) return;
    startTransition(async () => {
      const result = await approveRefundAction(refund.id, refund.orderNumber);
      if (!result.ok) {
        toast.error(result.error ?? 'Approval failed');
        return;
      }
      toast.success(`Refund ${refund.refundNumber} approved`);
      router.refresh();
    });
  }

  function reject() {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast.error('Add a short reason for rejecting');
      return;
    }
    startTransition(async () => {
      const result = await rejectRefundAction(rejectTarget.id, rejectTarget.orderNumber, {
        reason: rejectReason.trim(),
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Rejection failed');
        return;
      }
      toast.success(`Refund ${rejectTarget.refundNumber} rejected`);
      setRejectTarget(null);
      setRejectReason('');
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={currentStatus === tab.value ? 'default' : 'outline'}
            onClick={() => switchTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {initial.length === 0 ? (
        <EmptyState
          title="Nothing in this queue"
          description={
            currentStatus === 'pending_admin_approval'
              ? 'No refund requests awaiting approval.'
              : `No refunds with status ${currentStatus}.`
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {initial.map((refund) => (
            <li key={refund.id} className="rounded-2xl border border-ink-100 bg-snow p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] text-ink-900">{refund.refundNumber}</span>
                    <Link
                      href={`/orders/${refund.orderNumber}`}
                      className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-500 hover:text-ink-900"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {refund.orderNumber}
                    </Link>
                    <Pill tone={toneFor(refund.status)}>{refund.status.replace(/_/g, ' ')}</Pill>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-900">{refund.reason}</p>
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    ₹{(refund.amountPaisa / 100).toLocaleString('en-IN')} · requested{' '}
                    {new Date(refund.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {refund.rejectedReason ? (
                    <p className="mt-1 text-[12px] text-danger">Rejected: {refund.rejectedReason}</p>
                  ) : null}
                </div>
                {refund.status === 'pending_admin_approval' ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => approve(refund)} disabled={pending}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectTarget(refund)} disabled={pending}>
                      <X className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={rejectTarget !== null} onOpenChange={(v) => (!v ? setRejectTarget(null) : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject refund {rejectTarget?.refundNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="queue-reject-reason">Reason (visible to staff)</Label>
            <Textarea
              id="queue-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectTarget(null)} disabled={pending}>
              Keep pending
            </Button>
            <Button variant="destructive" onClick={reject} disabled={pending}>
              {pending ? 'Rejecting…' : 'Reject refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toneFor(status: string): 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'pending_admin_approval':
      return 'warning';
    case 'approved':
    case 'completed':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}
