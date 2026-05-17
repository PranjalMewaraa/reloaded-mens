'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminOrderDetail } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/ui/pill';
import { Textarea } from '@/components/ui/textarea';
import { approveRefundAction, rejectRefundAction } from './actions';

type Refund = AdminOrderDetail['refunds'][number];

interface RefundDecisionPanelProps {
  orderNumber: string;
  refund: Refund;
  isAdmin: boolean;
}

// Renders one refund row + admin-only Approve/Reject buttons. Reject opens a tiny
// inline dialog so the rejection reason gets captured on the audit trail.
export function RefundDecisionPanel({ orderNumber, refund, isAdmin }: RefundDecisionPanelProps) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  const tone: 'warning' | 'success' | 'danger' | 'neutral' =
    refund.status === 'pending_admin_approval'
      ? 'warning'
      : refund.status === 'approved' || refund.status === 'completed'
      ? 'success'
      : refund.status === 'rejected'
      ? 'danger'
      : 'neutral';

  function approve() {
    if (typeof window !== 'undefined' && !window.confirm(`Approve refund ${refund.refundNumber}?`)) return;
    startTransition(async () => {
      const result = await approveRefundAction(refund.id, orderNumber);
      if (!result.ok) {
        toast.error(result.error ?? 'Approval failed');
        return;
      }
      toast.success(`Refund ${refund.refundNumber} approved`);
      router.refresh();
    });
  }

  function reject() {
    if (rejectReason.trim().length < 3) {
      toast.error('Add a short reason for rejecting');
      return;
    }
    startTransition(async () => {
      const result = await rejectRefundAction(refund.id, orderNumber, { reason: rejectReason.trim() });
      if (!result.ok) {
        toast.error(result.error ?? 'Rejection failed');
        return;
      }
      toast.success(`Refund ${refund.refundNumber} rejected`);
      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-ink-100 bg-snow p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-ink-900">{refund.refundNumber}</span>
            <Pill tone={tone}>{refund.status.replace(/_/g, ' ')}</Pill>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-700">{refund.reason}</p>
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            ₹{(refund.amountPaisa / 100).toLocaleString('en-IN')} · requested{' '}
            {new Date(refund.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
          {refund.rejectedReason ? (
            <p className="mt-1 text-[11.5px] text-danger">Rejected: {refund.rejectedReason}</p>
          ) : null}
        </div>
        {isAdmin && refund.status === 'pending_admin_approval' ? (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={approve} disabled={pending}>
              <Check className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={pending}>
              <X className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={rejectOpen} onOpenChange={(v) => (!v ? setRejectOpen(false) : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject refund {refund.refundNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason (visible to staff)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={pending}>
              Keep pending
            </Button>
            <Button variant="destructive" onClick={reject} disabled={pending}>
              {pending ? 'Rejecting…' : 'Reject refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
