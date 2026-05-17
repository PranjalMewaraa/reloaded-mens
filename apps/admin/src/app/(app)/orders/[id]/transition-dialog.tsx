'use client';

import * as React from 'react';
import { Wand2 } from 'lucide-react';
import { ORDER_STATE, type OrderTransitionTarget } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TransitionDialogProps {
  open: boolean;
  target: OrderTransitionTarget | null;
  currentTrackingNumber: string | null;
  onClose: () => void;
  onSubmit: (payload: { trackingNumber?: string; message?: string }) => void;
  pending: boolean;
}

// One dialog handles every transition. Only `shipped` exposes the trackingNumber
// field (with an "Auto-generate" button that asks the mock shipping provider for an
// AWB by leaving the field empty). Other transitions just accept an optional message.
export function TransitionDialog({
  open,
  target,
  currentTrackingNumber,
  onClose,
  onSubmit,
  pending,
}: TransitionDialogProps) {
  const [trackingNumber, setTrackingNumber] = React.useState('');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setTrackingNumber(currentTrackingNumber ?? '');
      setMessage('');
    }
  }, [open, currentTrackingNumber]);

  const isShipped = target === ORDER_STATE.SHIPPED;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as {target ? target.replace(/_/g, ' ') : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isShipped ? (
            <div className="space-y-1.5">
              <Label htmlFor="tracking">Tracking number</Label>
              <div className="flex gap-2">
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="MOCK-AWB-XXXXXX"
                  className="font-mono"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setTrackingNumber('')}
                  title="Let the mock provider auto-generate"
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Auto
                </Button>
              </div>
              <p className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                Leave empty + click Confirm to let the mock provider assign one.
              </p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="msg">Note (optional)</Label>
            <Textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Shows up on the timeline"
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                trackingNumber: trackingNumber.trim() || undefined,
                message: message.trim() || undefined,
              })
            }
            disabled={pending}
          >
            {pending ? 'Updating…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
