'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, MessageCircle, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { TrackingOrder } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { env } from '@/lib/env';
import { formatINR } from '@/lib/utils';

interface TrackingViewProps {
  order: TrackingOrder;
  token: string;
}

// Three milestones the customer cares about. We derive completion from explicit
// timestamps on the order rather than the latest state — this keeps the timeline
// stable if a later state demotes us (e.g. cancelled after shipped).
function deriveStages(order: TrackingOrder): Array<{ key: string; label: string; done: boolean; at: string | null }> {
  return [
    { key: 'placed', label: 'Placed', done: true, at: order.confirmedAt ?? order.placedAt },
    { key: 'shipped', label: 'Shipped', done: !!order.shippedAt, at: order.shippedAt },
    { key: 'delivered', label: 'Delivered', done: !!order.deliveredAt, at: order.deliveredAt },
  ];
}

export function TrackingView({ order, token }: TrackingViewProps) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const stages = deriveStages(order);
  const isCancelled = order.state === 'cancelled';
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    `Hi! About order ${order.orderNumber}`,
  )}`;

  async function submitCancel() {
    setPending(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/public/tracking/${encodeURIComponent(order.orderNumber)}/cancel?t=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(body.message ?? 'Cancel failed');
        return;
      }
      toast.success('Order cancelled');
      setCancelOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Three-stage timeline */}
      <section className="mt-6 rounded-2xl border border-ink-100 bg-snow p-5">
        <div className="grid grid-cols-3 gap-3">
          {stages.map((stage, idx) => (
            <div key={stage.key} className="flex flex-col items-center text-center">
              <div className="flex items-center w-full">
                <div className={`flex-1 ${idx === 0 ? 'invisible' : ''}`}>
                  <div className={`h-0.5 ${stages[idx - 1]?.done ? 'bg-ink-900' : 'bg-ink-100'}`} />
                </div>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                    stage.done ? 'border-ink-900 bg-ink-900 text-snow' : 'border-ink-200 bg-snow text-ink-300'
                  }`}
                >
                  <Check className="h-4 w-4" />
                </div>
                <div className={`flex-1 ${idx === stages.length - 1 ? 'invisible' : ''}`}>
                  <div className={`h-0.5 ${stage.done ? 'bg-ink-900' : 'bg-ink-100'}`} />
                </div>
              </div>
              <div className="mt-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-900">
                {stage.label}
              </div>
              {stage.at ? (
                <div className="text-[11px] text-ink-500">
                  {new Date(stage.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              ) : (
                <div className="text-[11px] text-ink-400">—</div>
              )}
            </div>
          ))}
        </div>
        {order.trackingNumber ? (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-ink-50 px-3 py-2 text-[12.5px] text-ink-900">
            <Truck className="h-4 w-4 text-ink-500" />
            <span>Tracking number</span>
            <span className="ml-auto font-mono">{order.trackingNumber}</span>
          </div>
        ) : null}
        {isCancelled ? (
          <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
            This order was cancelled{order.cancelReason ? ` — ${order.cancelReason}` : ''}.
          </div>
        ) : null}
      </section>

      {/* Self-cancel CTA */}
      {order.canCustomerCancel ? (
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-ink-100 bg-snow p-4">
          <div>
            <p className="text-[13px] font-medium text-ink-900">Need to cancel?</p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              You can self-cancel until we pack the order. After that, message us on
              WhatsApp.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
            Cancel order
          </Button>
        </section>
      ) : null}

      {/* Return / Exchange CTA — only visible once delivered. The destination page
          does the window + open-return checks. */}
      {order.state === 'delivered' ? (
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-ink-100 bg-snow p-4">
          <div>
            <p className="text-[13px] font-medium text-ink-900">Need to return or exchange?</p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              You can file a return for items within 7 days of delivery.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/track/${encodeURIComponent(order.orderNumber)}/return?t=${encodeURIComponent(token)}`}
            >
              Return / Exchange
            </a>
          </Button>
        </section>
      ) : null}

      {/* Line items + totals */}
      <section className="mt-6 rounded-2xl border border-ink-100 bg-snow p-5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
          Order summary
        </h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-[13px]">
              <div className="min-w-0">
                <div className="truncate text-ink-900">{item.productName}</div>
                <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                  {[item.variantLabel, item.sku, `qty ${item.quantity}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="font-mono text-[12.5px] text-ink-900">{formatINR(item.totalPaisa)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 text-[13px]">
          <div className="flex items-center justify-between text-ink-500">
            <span>Subtotal</span>
            <span>{formatINR(order.subtotalPaisa)}</span>
          </div>
          {order.discountPaisa > 0 ? (
            <div className="flex items-center justify-between text-success">
              <span>{order.appliedCouponCode ? `Discount · ${order.appliedCouponCode}` : 'Discount'}</span>
              <span>− {formatINR(order.discountPaisa)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-ink-500">
            <span>Shipping</span>
            <span>{order.shippingPaisa === 0 ? 'Free' : formatINR(order.shippingPaisa)}</span>
          </div>
          <div className="my-2 border-t border-ink-100" />
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-ink-900">Total paid</span>
            <span className="font-display text-[20px] font-semibold text-ink-900">{formatINR(order.totalPaisa)}</span>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-100 bg-snow p-5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
          Shipping to
        </h2>
        <p className="mt-2 text-[13px] leading-[1.55] text-ink-900">
          {order.shippingAddress.name}
          <br />
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
          <span className="font-mono">{order.shippingAddress.pincode}</span>
          <br />
          <span className="font-mono">{order.shippingAddress.phone}</span>
        </p>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 rounded-2xl bg-whatsapp px-4 py-3 text-snow shadow-soft hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-[13px] font-medium">Chat about this order</span>
        </a>
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-snow px-4 py-3 text-ink-400"
          title="Available after delivery (coming soon)"
        >
          <FileText className="h-4 w-4" />
          <span className="text-[13px] font-medium">Download invoice · coming soon</span>
        </button>
      </section>

      <Dialog open={cancelOpen} onOpenChange={(v) => (!v ? setCancelOpen(false) : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-[13px] text-ink-700">
              We&apos;ll restock the items and you&apos;ll be eligible for a refund. Refunds
              take 3–5 business days after admin approval.
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Reason (optional)"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={pending}>
              Keep order
            </Button>
            <Button variant="outline" onClick={submitCancel} disabled={pending} className="border-danger text-danger hover:bg-danger/5">
              {pending ? 'Cancelling…' : 'Cancel order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
