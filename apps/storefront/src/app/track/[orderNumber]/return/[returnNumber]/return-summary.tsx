'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CustomerReturnSummary } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill } from '@/components/ui/pill';
import { Textarea } from '@/components/ui/textarea';
import { cancelReturnRequest } from '@/lib/checkout-api';
import { formatINR } from '@/lib/utils';

interface ReturnSummaryProps {
  orderNumber: string;
  token: string;
  initial: CustomerReturnSummary;
}

export function ReturnSummary({ orderNumber, token, initial }: ReturnSummaryProps) {
  const router = useRouter();
  const [summary, setSummary] = React.useState(initial);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);

  async function submitCancel() {
    setPending(true);
    try {
      const next = await cancelReturnRequest(
        orderNumber,
        summary.returnNumber,
        token,
        reason.trim() || undefined,
      );
      setSummary(next);
      setCancelOpen(false);
      toast.success('Return cancelled');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message || 'Cancel failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {summary.rejectedReason ? (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
          {summary.rejectedReason}
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-ink-100 bg-snow p-5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Method</h2>
        <p className="mt-1 text-[13px] text-ink-900">{summary.method.replace(/_/g, ' ')}</p>
        {summary.customerNote ? (
          <p className="mt-2 whitespace-pre-line text-[12.5px] text-ink-700">{summary.customerNote}</p>
        ) : null}
        {summary.pickupScheduledAt ? (
          <p className="mt-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            Pickup scheduled · {new Date(summary.pickupScheduledAt).toLocaleString('en-IN')}
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-ink-100 bg-snow p-5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Lines</h2>
        <ul className="mt-3 space-y-3">
          {summary.items.map((line) => (
            <li key={line.id} className="border-b border-ink-100 pb-3 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink-900">{line.productName}</div>
                  <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    {[line.variantLabel, line.sku, `qty ${line.quantity}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill tone="neutral">{line.action}</Pill>
                  <span className="font-mono text-[12.5px] text-ink-900">
                    {formatINR(line.unitPricePaisa * line.quantity)}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[12px] text-ink-700">
                {line.reason.replace(/_/g, ' ')}
                {line.exchangeVariantLabel ? ` · exchange to ${line.exchangeVariantLabel}` : ''}
              </p>
              {line.reasonNote ? (
                <p className="mt-1 text-[12px] text-ink-500">“{line.reasonNote}”</p>
              ) : null}
              {line.photoUrls.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {line.photoUrls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="Return photo"
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {summary.canCustomerCancel ? (
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-ink-100 bg-snow p-4">
          <div>
            <p className="text-[13px] font-medium text-ink-900">Changed your mind?</p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Cancel the return before we receive the parcel. After that, message us on
              WhatsApp.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
            Cancel return
          </Button>
        </section>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={(v) => (!v ? setCancelOpen(false) : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this return?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-ink-700">
            We&apos;ll release any reserved exchange stock. You can always file a new return
            within the window.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Reason (optional)"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={pending}>
              Keep return
            </Button>
            <Button
              variant="outline"
              onClick={submitCancel}
              disabled={pending}
              className="border-danger text-danger hover:bg-danger/5"
            >
              {pending ? 'Cancelling…' : 'Cancel return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
