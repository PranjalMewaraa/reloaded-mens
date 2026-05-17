'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requestRefundAction } from './actions';

interface RefundDialogProps {
  open: boolean;
  orderNumber: string;
  orderId: string;
  amountPaisa: number;
  onClose: () => void;
}

// Sprint 5 — full-order refund only. Sprint 7+ will introduce partials with item
// selection. We pass the order's totalPaisa straight through; the server validates.
export function RefundDialog({ open, orderNumber, orderId, amountPaisa, onClose }: RefundDialogProps) {
  const router = useRouter();
  const [reason, setReason] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  function submit() {
    if (reason.trim().length < 3) {
      toast.error('Add a short reason for the refund');
      return;
    }
    startTransition(async () => {
      const result = await requestRefundAction(orderNumber, {
        orderId,
        amountPaisa,
        reason: reason.trim(),
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Refund request failed');
        return;
      }
      toast.success('Refund queued for admin approval');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[12.5px] text-ink-500">
            Full refund of{' '}
            <span className="font-mono text-ink-900">
              ₹{(amountPaisa / 100).toLocaleString('en-IN')}
            </span>
            . An admin must approve before the refund is processed.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why is this customer being refunded?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || reason.trim().length < 3}>
            {pending ? 'Submitting…' : 'Request refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
