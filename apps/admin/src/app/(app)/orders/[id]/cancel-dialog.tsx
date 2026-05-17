'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CancelDialogProps {
  open: boolean;
  canRestock: boolean;
  onClose: () => void;
  onSubmit: (reason: string, restock: boolean) => void;
  pending: boolean;
}

// Cancel dialog — captures the reason + a restock toggle. The toggle defaults on and
// is the right answer for almost every cancellation; admin unticks only for fraud
// cases where the merchandise isn't actually coming back to inventory.
export function CancelDialog({ open, canRestock, onClose, onSubmit, pending }: CancelDialogProps) {
  const [reason, setReason] = React.useState('');
  const [restock, setRestock] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      setReason('');
      setRestock(canRestock);
    }
  }, [open, canRestock]);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Reason (visible to staff + customer)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why is this order being cancelled?"
              required
            />
          </div>
          <label className="flex items-start gap-2 text-[13px] text-ink-900">
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300"
              disabled={!canRestock}
            />
            <span>
              Restock items
              <span className="ml-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                {canRestock ? 'Recommended' : 'Disabled — refund already processed'}
              </span>
            </span>
          </label>
          <p className="text-[12px] text-ink-500">
            Cancelling notifies the customer via the tracking page. They&apos;ll need a refund
            request to recover payment.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Keep order
          </Button>
          <Button
            variant="destructive"
            onClick={() => onSubmit(reason.trim(), restock)}
            disabled={pending || reason.trim().length < 3}
          >
            {pending ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
