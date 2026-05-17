'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  CircleDot,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RESTOCK_DECISION,
  RETURN_STATE,
  RETURN_TYPE,
  VERIFIED_CONDITION,
  type AdminReturnDetail,
  type ReturnLineSnapshot,
  type VerifyReturnLine,
} from '@repo/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/ui/pill';
import { Textarea } from '@/components/ui/textarea';
import {
  adminCancelReturnAction,
  approveReturnAction,
  markCompletedAction,
  markReceivedAction,
  rejectReturnAction,
  updateReturnNoteAction,
  verifyReturnAction,
} from './actions';

const RECEIVED_FROM: readonly string[] = [
  RETURN_STATE.PICKUP_SCHEDULED,
  RETURN_STATE.STORE_DROPOFF_PENDING,
  RETURN_STATE.IN_TRANSIT,
];

function rupees(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN')}`;
}

export function ReturnDetail({ detail }: { detail: AdminReturnDetail }) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = React.useState<
    'approve' | 'reject' | 'received' | 'verify' | 'cancel' | null
  >(null);
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function refresh() {
    setActiveDialog(null);
    router.refresh();
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? 'Failed');
        return;
      }
      toast.success(success);
      refresh();
    });
  }

  const isTerminal = ([RETURN_STATE.COMPLETED, RETURN_STATE.REJECTED, RETURN_STATE.CANCELLED] as string[]).includes(
    detail.state,
  );
  const canApprove = detail.state === RETURN_STATE.REQUESTED;
  const canReject = detail.state === RETURN_STATE.REQUESTED;
  const canMarkReceived = RECEIVED_FROM.includes(detail.state);
  const canVerify = detail.state === RETURN_STATE.RECEIVED;
  const canComplete = detail.state === RETURN_STATE.VERIFIED;
  const canCancel = !isTerminal && detail.state !== RETURN_STATE.VERIFIED;

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[7fr_5fr]">
        {/* LEFT — line items + customer */}
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[16px]">Lines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.items.map((line) => (
                <LineCard
                  key={line.id}
                  line={line}
                  onPhotoClick={setLightboxUrl}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Order + customer</CardTitle>
            </CardHeader>
            <CardContent className="text-[13px] text-ink-900">
              <Link
                href={`/orders/${detail.orderNumber}`}
                className="font-mono text-[13px] text-ink-900 underline-offset-4 hover:underline"
              >
                {detail.orderNumber}
              </Link>
              <p className="mt-2">{detail.customerName}</p>
              <p className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                {detail.customerPhone}
              </p>
              {detail.customerNote ? (
                <div className="mt-3 rounded-md bg-warning-100 px-3 py-2 text-[12.5px] text-warning">
                  <div className="font-mono text-[10.5px] uppercase tracking-caps">Customer note</div>
                  <p className="mt-1 normal-case tracking-normal">{detail.customerNote}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {detail.refundRequestNumber ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Linked refund</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href="/orders/refunds"
                  className="inline-flex items-center gap-2 font-mono text-[13px] text-ink-900 underline-offset-4 hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {detail.refundRequestNumber}
                </Link>
                <p className="mt-1 text-[12px] text-ink-500">
                  Approve from the refunds queue to move the order to refunded.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </section>

        {/* RIGHT — status + actions + note */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={toneFor(detail.state)} withDot>
                  {detail.state.replace(/_/g, ' ')}
                </Pill>
                <Pill tone="neutral">{detail.method.replace(/_/g, ' ')}</Pill>
              </div>
              {detail.rejectedReason ? (
                <p className="mt-3 text-[12px] text-danger">{detail.rejectedReason}</p>
              ) : null}
              {isTerminal ? (
                <p className="mt-3 text-[12px] text-ink-500">This return is terminal.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {canApprove ? (
                    <Button size="default" onClick={() => setActiveDialog('approve')} disabled={pending}>
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </Button>
                  ) : null}
                  {canMarkReceived ? (
                    <Button size="default" onClick={() => setActiveDialog('received')} disabled={pending}>
                      <Package className="mr-2 h-4 w-4" /> Mark received
                    </Button>
                  ) : null}
                  {canVerify ? (
                    <Button size="default" onClick={() => setActiveDialog('verify')} disabled={pending}>
                      <CircleDot className="mr-2 h-4 w-4" /> Verify
                    </Button>
                  ) : null}
                  {canComplete ? (
                    <Button
                      size="default"
                      onClick={() => run(() => markCompletedAction(detail.id), 'Return completed')}
                      disabled={pending}
                    >
                      <Truck className="mr-2 h-4 w-4" /> Mark completed
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button variant="outline" size="default" onClick={() => setActiveDialog('reject')} disabled={pending}>
                      Reject
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button variant="outline" size="default" onClick={() => setActiveDialog('cancel')} disabled={pending}>
                      <XCircle className="mr-2 h-4 w-4" /> Cancel return
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <InternalNote returnId={detail.id} initial={detail.internalNote ?? ''} />
        </aside>
      </div>

      {/* Dialogs */}
      <ApproveDialog
        open={activeDialog === 'approve'}
        method={detail.method}
        onClose={() => setActiveDialog(null)}
        onSubmit={(payload) =>
          run(() => approveReturnAction(detail.id, payload), 'Return approved')
        }
        pending={pending}
      />
      <RejectDialog
        open={activeDialog === 'reject'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(reason) =>
          run(() => rejectReturnAction(detail.id, { reason }), 'Return rejected')
        }
        pending={pending}
      />
      <MarkReceivedDialog
        open={activeDialog === 'received'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(note) =>
          run(() => markReceivedAction(detail.id, { note }), 'Return received')
        }
        pending={pending}
      />
      <VerifyDialog
        open={activeDialog === 'verify'}
        items={detail.items}
        onClose={() => setActiveDialog(null)}
        onSubmit={(payload) => run(() => verifyReturnAction(detail.id, payload), 'Return verified')}
        pending={pending}
      />
      <CancelDialog
        open={activeDialog === 'cancel'}
        onClose={() => setActiveDialog(null)}
        onSubmit={(reason) =>
          run(() => adminCancelReturnAction(detail.id, { reason }), 'Return cancelled')
        }
        pending={pending}
      />

      {lightboxUrl ? (
        <Dialog open onOpenChange={(v) => (!v ? setLightboxUrl(null) : null)}>
          <DialogContent className="max-w-3xl">
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-ink-50">
              <Image
                src={lightboxUrl}
                alt="Return photo"
                fill
                sizes="(min-width:768px) 800px, 100vw"
                className="object-contain"
                unoptimized
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function LineCard({
  line,
  onPhotoClick,
}: {
  line: ReturnLineSnapshot;
  onPhotoClick: (url: string) => void;
}) {
  return (
    <div className="rounded-md border border-ink-100 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink-900">{line.productName}</div>
          <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            {[line.variantLabel, line.sku, `qty ${line.quantity}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill tone={actionTone(line.action)}>{line.action}</Pill>
          <span className="font-mono text-[12.5px] text-ink-900">{rupees(line.unitPricePaisa * line.quantity)}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-700">
        <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
          Reason
        </span>
        <span>{line.reason.replace(/_/g, ' ')}</span>
        {line.exchangeVariantLabel ? (
          <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            Exchange to {line.exchangeVariantLabel}
          </span>
        ) : null}
      </div>
      {line.reasonNote ? (
        <p className="mt-1 text-[12px] text-ink-700">“{line.reasonNote}”</p>
      ) : null}
      {line.verifiedCondition ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-500">
          <span className="font-mono uppercase tracking-caps">Verified</span>
          <Pill tone="neutral">{line.verifiedCondition.replace(/_/g, ' ')}</Pill>
          <Pill tone={line.restockDecision === RESTOCK_DECISION.RESTOCK ? 'success' : line.restockDecision === RESTOCK_DECISION.DAMAGE_WRITEOFF ? 'danger' : 'warning'}>
            {line.restockDecision.replace(/_/g, ' ')}
          </Pill>
        </div>
      ) : null}
      {line.photoUrls.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {line.photoUrls.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => onPhotoClick(url)}
              className="relative h-16 w-16 overflow-hidden rounded-md bg-ink-50"
            >
              <Image src={url} alt="Return photo" fill sizes="64px" className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      ) : null}
      {line.exchangeReservedUntil ? (
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-caps text-warning">
          Exchange reserved until{' '}
          {new Date(line.exchangeReservedUntil).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
        </p>
      ) : null}
    </div>
  );
}

function InternalNote({ returnId, initial }: { returnId: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const dirty = value !== initial;

  function save() {
    startTransition(async () => {
      const result = await updateReturnNoteAction(returnId, { note: value });
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success('Note saved');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">Internal note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Staff-only notes (max 2000 chars)"
        />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            {value.length} / 2000
          </span>
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            {pending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ApproveDialog({
  open,
  method,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  method: string;
  onClose: () => void;
  onSubmit: (payload: { pickupScheduledAt?: string; internalNote?: string }) => void;
  pending: boolean;
}) {
  const [pickupDate, setPickupDate] = React.useState('');
  const [note, setNote] = React.useState('');
  const isCourier = method === 'courier_pickup';

  React.useEffect(() => {
    if (open) {
      setPickupDate('');
      setNote('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve return</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isCourier ? (
            <div className="space-y-1.5">
              <Label htmlFor="pickup-date">Pickup scheduled at (optional)</Label>
              <input
                id="pickup-date"
                type="datetime-local"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="flex h-12 w-full rounded-xl border border-ink-200 bg-snow px-3.5 text-[14px] text-ink-900"
              />
              <p className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                Leave empty to just approve; you can schedule the pickup later.
              </p>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-500">
              Store dropoff — the customer will bring the parcel in. Approving moves the
              return into the dropoff queue.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="approve-note">Internal note (optional)</Label>
            <Textarea
              id="approve-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
                pickupScheduledAt: pickupDate ? new Date(pickupDate).toISOString() : undefined,
                internalNote: note.trim() || undefined,
              })
            }
            disabled={pending}
          >
            {pending ? 'Approving…' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  open,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject return</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason (shown to customer)</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Outside the return window, fraud, etc."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => onSubmit(reason.trim())} disabled={pending || reason.trim().length < 3}>
            {pending ? 'Rejecting…' : 'Reject return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkReceivedDialog({
  open,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (note?: string) => void;
  pending: boolean;
}) {
  const [note, setNote] = React.useState('');
  React.useEffect(() => {
    if (open) setNote('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark received</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="received-note">Note (optional)</Label>
          <Textarea
            id="received-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. parcel intact, sealed"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(note.trim() || undefined)} disabled={pending}>
            {pending ? 'Saving…' : 'Mark received'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerifyDialog({
  open,
  items,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  items: ReturnLineSnapshot[];
  onClose: () => void;
  onSubmit: (payload: { lines: VerifyReturnLine[]; triggerRefund: boolean; internalNote?: string }) => void;
  pending: boolean;
}) {
  const [decisions, setDecisions] = React.useState<Record<string, VerifyReturnLine>>({});
  const [triggerRefund, setTriggerRefund] = React.useState(true);
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (open) {
      const initial: Record<string, VerifyReturnLine> = {};
      for (const line of items) {
        initial[line.id] = {
          returnLineItemId: line.id,
          verifiedCondition: VERIFIED_CONDITION.AS_NEW,
          restockDecision:
            line.reason === 'damaged' ? RESTOCK_DECISION.DAMAGE_WRITEOFF : RESTOCK_DECISION.RESTOCK,
        };
      }
      setDecisions(initial);
      setTriggerRefund(items.some((i) => i.action === RETURN_TYPE.RETURN));
      setNote('');
    }
  }, [open, items]);

  function update(id: string, patch: Partial<VerifyReturnLine>) {
    setDecisions((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verify return</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {items.map((line) => {
            const decision = decisions[line.id];
            if (!decision) return null;
            return (
              <div key={line.id} className="rounded-md border border-ink-100 p-3">
                <div className="text-[13px] font-medium text-ink-900">{line.productName}</div>
                <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                  {[line.variantLabel, line.sku, `qty ${line.quantity}`, line.action].filter(Boolean).join(' · ')}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                      Condition
                    </span>
                    <select
                      value={decision.verifiedCondition}
                      onChange={(e) =>
                        update(line.id, {
                          verifiedCondition: e.target.value as VerifyReturnLine['verifiedCondition'],
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-ink-200 bg-snow px-3 text-[13px] text-ink-900"
                    >
                      <option value={VERIFIED_CONDITION.AS_NEW}>As new</option>
                      <option value={VERIFIED_CONDITION.USED}>Used</option>
                      <option value={VERIFIED_CONDITION.DAMAGED}>Damaged</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                      Restock decision
                    </span>
                    <select
                      value={decision.restockDecision}
                      onChange={(e) =>
                        update(line.id, {
                          restockDecision: e.target.value as VerifyReturnLine['restockDecision'],
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-ink-200 bg-snow px-3 text-[13px] text-ink-900"
                    >
                      <option value={RESTOCK_DECISION.RESTOCK}>Restock</option>
                      <option value={RESTOCK_DECISION.DAMAGE_WRITEOFF}>Damage write-off</option>
                      <option value={RESTOCK_DECISION.PENDING}>Defer (pending)</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <label className="flex items-start gap-2 text-[13px] text-ink-900">
          <input
            type="checkbox"
            checked={triggerRefund}
            onChange={(e) => setTriggerRefund(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink-300"
          />
          <span>
            Trigger refund queue entry
            <span className="ml-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
              Admin must approve from /orders/refunds
            </span>
          </span>
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="verify-note">Internal note (optional)</Label>
          <Textarea
            id="verify-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                lines: Object.values(decisions),
                triggerRefund,
                internalNote: note.trim() || undefined,
              })
            }
            disabled={pending}
          >
            {pending ? 'Verifying…' : 'Mark verified'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel return</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-[13px] text-ink-700">
            Cancelling releases any held exchange reservations. The customer is notified
            via the order tracking page.
          </p>
          <Label htmlFor="admin-cancel-reason">Reason</Label>
          <Textarea
            id="admin-cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Keep return
          </Button>
          <Button variant="outline" onClick={() => onSubmit(reason.trim() || 'Cancelled by admin')} disabled={pending}>
            {pending ? 'Cancelling…' : 'Cancel return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function actionTone(action: string): 'clay' | 'info' | 'success' | 'neutral' {
  switch (action) {
    case RETURN_TYPE.RETURN:
      return 'clay';
    case RETURN_TYPE.EXCHANGE:
      return 'info';
    case RETURN_TYPE.REPLACEMENT:
      return 'success';
    default:
      return 'neutral';
  }
}

function toneFor(
  state: string,
): 'warning' | 'info' | 'clay' | 'success' | 'neutral' | 'danger' {
  switch (state) {
    case 'requested':
      return 'warning';
    case 'approved':
    case 'pickup_scheduled':
    case 'store_dropoff_pending':
      return 'info';
    case 'in_transit':
    case 'received':
      return 'clay';
    case 'verified':
    case 'completed':
      return 'success';
    case 'rejected':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}
