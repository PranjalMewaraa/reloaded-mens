'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Circle,
  FileText,
  MessageSquare,
  Package,
  PackageX,
  Printer,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ORDER_STATE,
  type AdminOrderDetail,
  type OrderTransitionTarget,
} from '@repo/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { env } from '@/lib/env';
import { TransitionDialog } from './transition-dialog';
import { CancelDialog } from './cancel-dialog';
import { InternalNote } from './internal-note';
import { Timeline } from './timeline';
import { RefundDialog } from './refund-dialog';
import { RefundDecisionPanel } from './refund-decision-panel';
import {
  cancelOrderAction,
  sendReviewInviteAction,
  transitionOrderAction,
} from './actions';

// Allowed forward transitions per state — mirrors the API state machine. Re-implemented
// here so we don't need to call the server to know which buttons to show.
const TRANSITIONS: Record<string, OrderTransitionTarget[]> = {
  [ORDER_STATE.PAYMENT_PENDING]: [],
  [ORDER_STATE.CONFIRMED]: [ORDER_STATE.PACKED as OrderTransitionTarget],
  [ORDER_STATE.PACKED]: [ORDER_STATE.SHIPPED as OrderTransitionTarget],
  [ORDER_STATE.SHIPPED]: [
    ORDER_STATE.OUT_FOR_DELIVERY as OrderTransitionTarget,
    ORDER_STATE.DELIVERED as OrderTransitionTarget,
  ],
  [ORDER_STATE.OUT_FOR_DELIVERY]: [ORDER_STATE.DELIVERED as OrderTransitionTarget],
};

interface OrderDetailProps {
  order: AdminOrderDetail;
  role: string;
}

function rupees(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN')}`;
}

export function OrderDetail({ order, role }: OrderDetailProps) {
  const router = useRouter();
  const [transitionTarget, setTransitionTarget] = React.useState<OrderTransitionTarget | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const nextTargets = TRANSITIONS[order.state] ?? [];
  const isAdmin = role === 'admin';
  const isTerminal = ([
    ORDER_STATE.DELIVERED,
    ORDER_STATE.CANCELLED,
    ORDER_STATE.REFUNDED,
    ORDER_STATE.RETURNED,
  ] as string[]).includes(order.state);
  const cancelAllowed = !isTerminal && order.state !== ORDER_STATE.PAYMENT_FAILED;
  const refundable =
    order.paymentState === 'paid' &&
    !order.refunds.some((r) => r.status === 'pending_admin_approval' || r.status === 'approved');

  const labelHref = `${env.NEXT_PUBLIC_ADMIN_API_URL}/api/v1/orders/${encodeURIComponent(order.orderNumber)}/label`;

  function handleTransition(target: OrderTransitionTarget, payload?: { trackingNumber?: string; message?: string }) {
    startTransition(async () => {
      const result = await transitionOrderAction(order.orderNumber, {
        target,
        trackingNumber: payload?.trackingNumber,
        message: payload?.message,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Transition failed');
        return;
      }
      toast.success(`Marked ${target.replace(/_/g, ' ')}`);
      setTransitionTarget(null);
      router.refresh();
    });
  }

  function handleCancel(reason: string, restock: boolean) {
    startTransition(async () => {
      const result = await cancelOrderAction(order.orderNumber, { reason, restock });
      if (!result.ok) {
        toast.error(result.error ?? 'Cancel failed');
        return;
      }
      toast.success('Order cancelled');
      setCancelOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[7fr_5fr]">
        {/* LEFT — items, address, payment, refund history */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[16px]">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-ink-100">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-[13px]">
                    <div className="min-w-0">
                      <div className="truncate text-ink-900">{item.productName}</div>
                      <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                        {[item.variantLabel, item.sku, `qty ${item.quantity}`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className="font-mono text-[12.5px] text-ink-900">{rupees(item.totalPaisa)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 text-[13px]">
                <SummaryRow label="Subtotal" value={rupees(order.subtotalPaisa)} />
                {order.discountPaisa > 0 ? (
                  <SummaryRow
                    label={order.appliedCouponCode ? `Discount · ${order.appliedCouponCode}` : 'Discount'}
                    value={`− ${rupees(order.discountPaisa)}`}
                    tone="success"
                  />
                ) : null}
                {order.appliedPromotionIds && order.appliedPromotionIds.length > 0 ? (
                  <div className="pt-1 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    Applied: {order.appliedPromotionIds.length} promotion{order.appliedPromotionIds.length === 1 ? '' : 's'}
                  </div>
                ) : null}
                <SummaryRow label="Shipping" value={order.shippingPaisa === 0 ? 'Free' : rupees(order.shippingPaisa)} />
                <SummaryRow label="GST (incl.)" value={rupees(order.taxPaisa)} tone="muted" />
                <div className="my-2 border-t border-ink-100" />
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-ink-900">Total</span>
                  <span className="font-mono text-[16px] font-semibold text-ink-900">{rupees(order.totalPaisa)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[16px]">Shipping to</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] leading-[1.55] text-ink-900">
                {order.shippingAddress.name}
                <br />
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                <span className="font-mono">{order.shippingAddress.pincode}</span>
                <br />
                <span className="font-mono">{order.shippingAddress.phone}</span>
                {order.contact.email ? (
                  <>
                    <br />
                    <span className="font-mono text-ink-500">{order.contact.email}</span>
                  </>
                ) : null}
              </p>
              {order.trackingNumber ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1 font-mono text-[12px] text-ink-900">
                  <Truck className="h-3.5 w-3.5" /> {order.trackingNumber}
                </div>
              ) : null}
              {order.customerNote ? (
                <div className="mt-4 rounded-md bg-warning-100 px-3 py-2 text-[12.5px] text-warning">
                  <div className="font-mono text-[10.5px] uppercase tracking-caps">Customer note</div>
                  <p className="mt-1">{order.customerNote}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[16px]">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              {order.payment ? (
                <div className="flex items-center justify-between text-[13px]">
                  <div>
                    <div className="text-ink-900">
                      {order.payment.provider.toUpperCase()} · {rupees(order.payment.amountPaisa)}
                    </div>
                    <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                      {order.payment.capturedAt
                        ? `Captured ${new Date(order.payment.capturedAt).toLocaleString('en-IN')}`
                        : 'Awaiting capture'}
                    </div>
                  </div>
                  <Pill tone={order.payment.status === 'captured' ? 'success' : order.payment.status === 'failed' ? 'danger' : 'warning'}>
                    {order.payment.status}
                  </Pill>
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-500">No payment record yet.</p>
              )}
            </CardContent>
          </Card>

          {order.refunds.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[16px]">Refunds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.refunds.map((refund) => (
                  <RefundDecisionPanel
                    key={refund.id}
                    orderNumber={order.orderNumber}
                    refund={refund}
                    isAdmin={isAdmin}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
        </section>

        {/* RIGHT — transition actions, timeline, internal note */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Pill tone="info" withDot>
                  {order.state.replace(/_/g, ' ')}
                </Pill>
                <Pill tone={order.paymentState === 'paid' ? 'success' : 'neutral'}>
                  Payment · {order.paymentState}
                </Pill>
              </div>
              {isTerminal ? (
                <p className="mt-3 text-[12.5px] text-ink-500">
                  This order is terminal. {order.state === ORDER_STATE.DELIVERED ? 'Sprint 6 will add the return flow.' : ''}
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {nextTargets.map((target) => (
                    <Button
                      key={target}
                      size="default"
                      onClick={() => setTransitionTarget(target)}
                      disabled={pending}
                    >
                      {iconForTarget(target)}
                      <span className="ml-2">{labelForTarget(target)}</span>
                    </Button>
                  ))}
                  {nextTargets.length === 0 && order.state === ORDER_STATE.PAYMENT_PENDING ? (
                    <p className="text-[12px] text-ink-500">
                      Waiting on payment webhook. Once captured the order auto-confirms.
                    </p>
                  ) : null}
                  {cancelAllowed ? (
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setCancelOpen(true)}
                      disabled={pending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel order
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {order.state === ORDER_STATE.PACKED || order.state === ORDER_STATE.SHIPPED ? (
            <Button asChild variant="outline" size="default" className="w-full">
              <a href={labelHref} target="_blank" rel="noopener">
                <Printer className="mr-2 h-4 w-4" /> Download label
              </a>
            </Button>
          ) : null}

          {refundable ? (
            <Button variant="outline" size="default" className="w-full" onClick={() => setRefundOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Request refund
            </Button>
          ) : null}

          {order.trackingToken ? (
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link
                href={`${env.NEXT_PUBLIC_STOREFRONT_URL}/track/${encodeURIComponent(order.orderNumber)}?t=${order.trackingToken}`}
                target="_blank"
                rel="noopener"
              >
                <FileText className="mr-2 h-4 w-4" />
                Open customer tracking link
              </Link>
            </Button>
          ) : null}

          {order.state === ORDER_STATE.DELIVERED ? (
            <Button
              variant="outline"
              size="default"
              className="w-full"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await sendReviewInviteAction(order.id, order.orderNumber);
                  if (!result.ok || !result.data) {
                    toast.error(result.error ?? 'Failed to send invite');
                    return;
                  }
                  toast.success(`Review invite sent to ${result.data.to}`);
                  router.refresh();
                });
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" /> Send review invite
            </Button>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline events={order.events} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">
                <MessageSquare className="mr-2 inline h-4 w-4 align-text-bottom text-ink-500" />
                Internal note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InternalNote orderNumber={order.orderNumber} initial={order.internalNote ?? ''} />
            </CardContent>
          </Card>
        </aside>
      </div>

      <TransitionDialog
        open={transitionTarget !== null}
        target={transitionTarget}
        currentTrackingNumber={order.trackingNumber}
        onClose={() => setTransitionTarget(null)}
        onSubmit={(payload) => transitionTarget && handleTransition(transitionTarget, payload)}
        pending={pending}
      />
      <CancelDialog
        open={cancelOpen}
        canRestock={!order.refunds.some((r) => r.status === 'approved' || r.status === 'completed')}
        onClose={() => setCancelOpen(false)}
        onSubmit={(reason, restock) => handleCancel(reason, restock)}
        pending={pending}
      />
      <RefundDialog
        open={refundOpen}
        orderNumber={order.orderNumber}
        orderId={order.id}
        amountPaisa={order.totalPaisa}
        onClose={() => setRefundOpen(false)}
      />
    </>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'muted';
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-ink-500">{label}</span>
      <span className={tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-ink-400' : 'text-ink-900'}>
        {value}
      </span>
    </div>
  );
}

function iconForTarget(target: OrderTransitionTarget) {
  switch (target) {
    case ORDER_STATE.PACKED:
      return <Package className="h-4 w-4" />;
    case ORDER_STATE.SHIPPED:
      return <Truck className="h-4 w-4" />;
    case ORDER_STATE.OUT_FOR_DELIVERY:
      return <PackageX className="h-4 w-4" />;
    case ORDER_STATE.DELIVERED:
      return <Check className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

function labelForTarget(target: OrderTransitionTarget): string {
  switch (target) {
    case ORDER_STATE.PACKED:
      return 'Mark packed';
    case ORDER_STATE.SHIPPED:
      return 'Mark shipped';
    case ORDER_STATE.OUT_FOR_DELIVERY:
      return 'Out for delivery';
    case ORDER_STATE.DELIVERED:
      return 'Mark delivered';
    case ORDER_STATE.CONFIRMED:
      return 'Mark confirmed';
    default:
      return target;
  }
}
