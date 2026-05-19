'use client';

// Multi-step return flow. 5 steps: items → reason → action → method → confirm.
// All state lives client-side; we only POST at the final step. Photo uploads happen
// inline so the customer sees progress per photo without batching.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  RETURN_METHOD,
  RETURN_REASON,
  RETURN_TYPE,
  type ReturnEligibilityResponse,
  type ReturnableItem,
} from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createReturnRequest,
  uploadReturnPhoto,
} from '@/lib/checkout-api';
import { cn, formatINR } from '@/lib/utils';

interface LineDraft {
  orderItemId: string;
  quantity: number;
  reason: string;
  reasonNote: string;
  action: string;
  exchangeVariantId?: string;
  photoUrls: string[];
}

interface ReturnFlowProps {
  orderNumber: string;
  token: string;
  eligibility: ReturnEligibilityResponse;
}

type Step = 'items' | 'reason' | 'action' | 'method' | 'confirm';

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'items', label: '1 · Items' },
  { key: 'reason', label: '2 · Reason' },
  { key: 'action', label: '3 · Action' },
  { key: 'method', label: '4 · Method' },
  { key: 'confirm', label: '5 · Confirm' },
];

export function ReturnFlow({ orderNumber, token, eligibility }: ReturnFlowProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('items');
  const [drafts, setDrafts] = React.useState<Map<string, LineDraft>>(new Map());
  const [method, setMethod] = React.useState<string>(RETURN_METHOD.COURIER_PICKUP);
  const [customerNote, setCustomerNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Variant pickers fetch siblings on demand — keep a cache to avoid re-fetching.
  const [variantCache, setVariantCache] = React.useState<
    Map<string, Array<{ id: string; size: string | null; color: string | null; stockCount: number; reservedForExchange: number }>>
  >(new Map());

  function toggleItem(item: ReturnableItem, checked: boolean) {
    setDrafts((current) => {
      const next = new Map(current);
      if (checked) {
        next.set(item.orderItemId, {
          orderItemId: item.orderItemId,
          quantity: 1,
          reason: RETURN_REASON.SIZE_ISSUE,
          reasonNote: '',
          action: RETURN_TYPE.RETURN,
          photoUrls: [],
        });
      } else {
        next.delete(item.orderItemId);
      }
      return next;
    });
  }

  function updateDraft(orderItemId: string, patch: Partial<LineDraft>) {
    setDrafts((current) => {
      const draft = current.get(orderItemId);
      if (!draft) return current;
      const next = new Map(current);
      next.set(orderItemId, { ...draft, ...patch });
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await createReturnRequest(orderNumber, token, {
        method: method as 'courier_pickup' | 'store_dropoff',
        customerNote: customerNote.trim() || undefined,
        items: Array.from(drafts.values()).map((d) => ({
          orderItemId: d.orderItemId,
          quantity: d.quantity,
          reason: d.reason as Parameters<typeof createReturnRequest>[2]['items'][number]['reason'],
          reasonNote: d.reasonNote.trim() || undefined,
          action: d.action as Parameters<typeof createReturnRequest>[2]['items'][number]['action'],
          exchangeVariantId: d.exchangeVariantId,
          photoUrls: d.photoUrls,
        })),
      });
      toast.success(`Return ${result.returnNumber} filed`);
      router.replace(
        `/track/${encodeURIComponent(orderNumber)}/return/${encodeURIComponent(result.returnNumber)}?t=${encodeURIComponent(token)}`,
      );
    } catch (err) {
      toast.error((err as Error).message || 'Failed to file return');
      setSubmitting(false);
    }
  }

  const selectedItems = Array.from(drafts.values());
  const itemsById = new Map(eligibility.items.map((i) => [i.orderItemId, i]));
  const canAdvanceFromItems = selectedItems.length > 0;
  const canAdvanceFromReason = selectedItems.every(
    (d) =>
      d.reason !== RETURN_REASON.DAMAGED && d.reason !== RETURN_REASON.QUALITY
        ? true
        : d.photoUrls.length > 0,
  );
  const canAdvanceFromAction = selectedItems.every(
    (d) => d.action !== RETURN_TYPE.EXCHANGE || Boolean(d.exchangeVariantId),
  );

  return (
    <>
      <ol className="mt-6 flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-caps text-ink-500">
        {STEPS.map((s, idx) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={cn('font-mono', s.key === step && 'text-ink-900')}>{s.label}</span>
            {idx < STEPS.length - 1 ? <ChevronRight className="h-3 w-3 text-ink-300" /> : null}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === 'items' ? (
          <ItemsStep
            items={eligibility.items}
            drafts={drafts}
            onToggle={toggleItem}
            onUpdate={updateDraft}
          />
        ) : null}
        {step === 'reason' ? (
          <ReasonStep
            selectedItems={selectedItems}
            itemsById={itemsById}
            orderNumber={orderNumber}
            token={token}
            onUpdate={updateDraft}
          />
        ) : null}
        {step === 'action' ? (
          <ActionStep
            selectedItems={selectedItems}
            itemsById={itemsById}
            variantCache={variantCache}
            setVariantCache={setVariantCache}
            onUpdate={updateDraft}
          />
        ) : null}
        {step === 'method' ? (
          <MethodStep
            method={method}
            setMethod={setMethod}
            customerNote={customerNote}
            setCustomerNote={setCustomerNote}
          />
        ) : null}
        {step === 'confirm' ? (
          <ConfirmStep
            selectedItems={selectedItems}
            itemsById={itemsById}
            method={method}
            customerNote={customerNote}
          />
        ) : null}
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            const idx = STEPS.findIndex((s) => s.key === step);
            if (idx > 0) setStep(STEPS[idx - 1].key);
          }}
          disabled={step === 'items' || submitting}
        >
          Back
        </Button>
        {step === 'confirm' ? (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Filing…
              </>
            ) : (
              'Submit return request'
            )}
          </Button>
        ) : (
          <Button
            onClick={() => {
              const idx = STEPS.findIndex((s) => s.key === step);
              if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
            }}
            disabled={
              (step === 'items' && !canAdvanceFromItems) ||
              (step === 'reason' && !canAdvanceFromReason) ||
              (step === 'action' && !canAdvanceFromAction)
            }
          >
            Continue
          </Button>
        )}
      </div>
    </>
  );
}

function ItemsStep({
  items,
  drafts,
  onToggle,
  onUpdate,
}: {
  items: ReturnableItem[];
  drafts: Map<string, LineDraft>;
  onToggle: (item: ReturnableItem, checked: boolean) => void;
  onUpdate: (orderItemId: string, patch: Partial<LineDraft>) => void;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const draft = drafts.get(item.orderItemId);
        const selected = Boolean(draft);
        return (
          <li
            key={item.orderItemId}
            className={cn(
              'rounded-2xl border p-4',
              selected ? 'border-ink-900 bg-snow' : 'border-ink-100 bg-snow',
            )}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onToggle(item, e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-ink-300"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-ink-900">{item.productName}</div>
                <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                  {[item.variantLabel, item.sku].filter(Boolean).join(' · ')}
                </div>
                <div className="mt-1 text-[12.5px] text-ink-500">
                  {formatINR(item.unitPricePaisa)} ·{' '}
                  {item.returnableQuantity === item.quantityOrdered
                    ? `${item.quantityOrdered} returnable`
                    : `${item.returnableQuantity} of ${item.quantityOrdered} returnable`}
                </div>
                {selected ? (
                  <div className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-700">
                    <span>Qty</span>
                    <select
                      value={draft!.quantity}
                      onChange={(e) =>
                        onUpdate(item.orderItemId, { quantity: Number(e.target.value) })
                      }
                      className="h-9 rounded-md border border-ink-200 bg-snow px-2 font-mono text-[12.5px]"
                    >
                      {Array.from({ length: item.returnableQuantity }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReasonStep({
  selectedItems,
  itemsById,
  orderNumber,
  token,
  onUpdate,
}: {
  selectedItems: LineDraft[];
  itemsById: Map<string, ReturnableItem>;
  orderNumber: string;
  token: string;
  onUpdate: (orderItemId: string, patch: Partial<LineDraft>) => void;
}) {
  return (
    <div className="space-y-3">
      {selectedItems.map((draft) => {
        const item = itemsById.get(draft.orderItemId)!;
        const needsPhoto = draft.reason === RETURN_REASON.DAMAGED || draft.reason === RETURN_REASON.QUALITY;
        return (
          <div key={draft.orderItemId} className="rounded-2xl border border-ink-100 bg-snow p-4">
            <div className="text-[13px] font-medium text-ink-900">{item.productName}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
              {[item.variantLabel, item.sku, `qty ${draft.quantity}`].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Reason</span>
                <select
                  value={draft.reason}
                  onChange={(e) => onUpdate(draft.orderItemId, { reason: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-ink-200 bg-snow px-3 text-[13px] text-ink-900"
                >
                  <option value={RETURN_REASON.SIZE_ISSUE}>Size doesn&apos;t fit</option>
                  <option value={RETURN_REASON.QUALITY}>Quality issue</option>
                  <option value={RETURN_REASON.NOT_AS_EXPECTED}>Not as expected</option>
                  <option value={RETURN_REASON.DAMAGED}>Damaged on arrival</option>
                  <option value={RETURN_REASON.OTHER}>Something else</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Notes (optional)</span>
                <Input
                  value={draft.reasonNote}
                  onChange={(e) => onUpdate(draft.orderItemId, { reasonNote: e.target.value })}
                  maxLength={500}
                  className="h-10"
                />
              </label>
            </div>
            {needsPhoto ? (
              <PhotoUploader
                photoUrls={draft.photoUrls}
                onChange={(next) => onUpdate(draft.orderItemId, { photoUrls: next })}
                orderNumber={orderNumber}
                token={token}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PhotoUploader({
  photoUrls,
  onChange,
  orderNumber,
  token,
}: {
  photoUrls: string[];
  onChange: (next: string[]) => void;
  orderNumber: string;
  token: string;
}) {
  const [uploading, setUploading] = React.useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const additions: string[] = [];
      for (let i = 0; i < files.length && photoUrls.length + additions.length < 5; i += 1) {
        try {
          const result = await uploadReturnPhoto(orderNumber, token, files[i]);
          additions.push(result.url);
        } catch (err) {
          toast.error(`${files[i].name}: ${(err as Error).message}`);
        }
      }
      if (additions.length > 0) onChange([...photoUrls, ...additions]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
        Photos (up to 5){' '}
        <span className={photoUrls.length === 0 ? 'text-danger' : 'text-ink-500'}>
          {photoUrls.length === 0 ? 'Required' : `${photoUrls.length} uploaded`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {photoUrls.map((url) => (
          <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md bg-ink-50">
            <img src={url} alt="Return photo" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photoUrls.filter((u) => u !== url))}
              className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink-900 text-snow"
              aria-label="Remove photo"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {photoUrls.length < 5 ? (
          <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-md border-2 border-dashed border-ink-200 text-ink-500 hover:border-ink-900">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function ActionStep({
  selectedItems,
  itemsById,
  variantCache,
  setVariantCache,
  onUpdate,
}: {
  selectedItems: LineDraft[];
  itemsById: Map<string, ReturnableItem>;
  variantCache: Map<
    string,
    Array<{ id: string; size: string | null; color: string | null; stockCount: number; reservedForExchange: number }>
  >;
  setVariantCache: React.Dispatch<
    React.SetStateAction<
      Map<
        string,
        Array<{ id: string; size: string | null; color: string | null; stockCount: number; reservedForExchange: number }>
      >
    >
  >;
  onUpdate: (orderItemId: string, patch: Partial<LineDraft>) => void;
}) {
  // Fetch siblings lazily per product slug.
  async function ensureVariants(productSlug: string) {
    if (variantCache.has(productSlug)) return;
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/public/products/${encodeURIComponent(productSlug)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json();
      const variants = (body?.product?.variants ?? []) as Array<{
        id: string;
        size: string | null;
        color: string | null;
        stockCount: number;
      }>;
      setVariantCache((current) => {
        const next = new Map(current);
        next.set(
          productSlug,
          variants.map((v) => ({
            id: v.id,
            size: v.size,
            color: v.color,
            stockCount: v.stockCount,
            reservedForExchange: 0,
          })),
        );
        return next;
      });
    } catch {
      // Silent — admin can always swap to return/replacement if exchange picker fails.
    }
  }

  return (
    <div className="space-y-3">
      {selectedItems.map((draft) => {
        const item = itemsById.get(draft.orderItemId)!;
        const siblings = variantCache.get(item.productSlug) ?? null;
        return (
          <div key={draft.orderItemId} className="rounded-2xl border border-ink-100 bg-snow p-4">
            <div className="text-[13px] font-medium text-ink-900">{item.productName}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
              {[item.variantLabel, item.sku, `qty ${draft.quantity}`].filter(Boolean).join(' · ')}
            </div>
            <fieldset className="mt-3">
              <legend className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Action</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { v: RETURN_TYPE.RETURN, label: 'Return', desc: 'Refund the money' },
                  { v: RETURN_TYPE.EXCHANGE, label: 'Exchange', desc: 'Different size/colour' },
                  { v: RETURN_TYPE.REPLACEMENT, label: 'Replacement', desc: 'Same item, new unit' },
                ].map((opt) => (
                  <label
                    key={opt.v}
                    className={cn(
                      'cursor-pointer rounded-md border p-3 text-[12.5px]',
                      draft.action === opt.v
                        ? 'border-ink-900 bg-ink-50/50'
                        : 'border-ink-200 hover:border-ink-400',
                    )}
                  >
                    <input
                      type="radio"
                      name={`action-${draft.orderItemId}`}
                      value={opt.v}
                      checked={draft.action === opt.v}
                      onChange={() => {
                        onUpdate(draft.orderItemId, { action: opt.v, exchangeVariantId: undefined });
                        if (opt.v === RETURN_TYPE.EXCHANGE) void ensureVariants(item.productSlug);
                      }}
                      className="hidden"
                    />
                    <div className="font-medium text-ink-900">{opt.label}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-500">{opt.desc}</div>
                  </label>
                ))}
              </div>
            </fieldset>
            {draft.action === RETURN_TYPE.EXCHANGE ? (
              <div className="mt-3">
                <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                  Pick the replacement variant
                </span>
                {siblings === null ? (
                  <p className="mt-2 text-[12px] text-ink-500">Loading available options…</p>
                ) : siblings.length === 0 ? (
                  <p className="mt-2 text-[12px] text-danger">
                    No other variants are in stock. Try Return or Replacement instead.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {siblings
                      .filter((v) => v.id !== item.variantId && v.stockCount > 0)
                      .map((variant) => {
                        const label = [variant.size, variant.color].filter(Boolean).join(' · ') || variant.id;
                        const selected = draft.exchangeVariantId === variant.id;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => onUpdate(draft.orderItemId, { exchangeVariantId: variant.id })}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-[12.5px]',
                              selected
                                ? 'border-ink-900 bg-ink-900 text-snow'
                                : 'border-ink-200 bg-snow text-ink-900 hover:border-ink-900',
                            )}
                          >
                            {label}
                            <span className="ml-2 font-mono text-[10.5px] text-ink-400">
                              {selected ? '' : `${variant.stockCount} in stock`}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MethodStep({
  method,
  setMethod,
  customerNote,
  setCustomerNote,
}: {
  method: string;
  setMethod: (v: string) => void;
  customerNote: string;
  setCustomerNote: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          {
            v: RETURN_METHOD.COURIER_PICKUP,
            label: 'Courier pickup',
            desc: 'We arrange a pickup from your address',
          },
          {
            v: RETURN_METHOD.STORE_DROPOFF,
            label: 'Store dropoff',
            desc: 'Drop off at our Ghaziabad store',
          },
        ].map((opt) => (
          <label
            key={opt.v}
            className={cn(
              'cursor-pointer rounded-2xl border p-4 text-[13px]',
              method === opt.v ? 'border-ink-900 bg-ink-50/50' : 'border-ink-200 hover:border-ink-400',
            )}
          >
            <input
              type="radio"
              name="method"
              value={opt.v}
              checked={method === opt.v}
              onChange={() => setMethod(opt.v)}
              className="hidden"
            />
            <div className="font-medium text-ink-900">{opt.label}</div>
            <div className="mt-1 text-[12px] text-ink-500">{opt.desc}</div>
          </label>
        ))}
      </div>
      <label className="block">
        <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
          Anything else? (optional)
        </span>
        <Textarea
          value={customerNote}
          onChange={(e) => setCustomerNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Preferred pickup time, drop-off store location, etc."
          className="mt-1"
        />
      </label>
    </div>
  );
}

function ConfirmStep({
  selectedItems,
  itemsById,
  method,
  customerNote,
}: {
  selectedItems: LineDraft[];
  itemsById: Map<string, ReturnableItem>;
  method: string;
  customerNote: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-100 bg-snow p-4">
        <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
          {selectedItems.length} line{selectedItems.length === 1 ? '' : 's'}
        </div>
        <ul className="mt-2 divide-y divide-ink-100">
          {selectedItems.map((draft) => {
            const item = itemsById.get(draft.orderItemId)!;
            return (
              <li key={draft.orderItemId} className="py-3 text-[12.5px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-ink-900">{item.productName}</div>
                    <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                      {[item.variantLabel, item.sku, `qty ${draft.quantity}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="text-right text-[12px] text-ink-500">
                    <div>{draft.reason.replace(/_/g, ' ')}</div>
                    <div className="font-mono text-[10.5px] uppercase tracking-caps">{draft.action}</div>
                  </div>
                </div>
                {draft.photoUrls.length > 0 ? (
                  <div className="mt-2 font-mono text-[10.5px] text-ink-500">
                    {draft.photoUrls.length} photo{draft.photoUrls.length === 1 ? '' : 's'}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-2xl border border-ink-100 bg-snow p-4 text-[13px]">
        <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Method</div>
        <div className="mt-1 text-ink-900">{method.replace(/_/g, ' ')}</div>
        {customerNote ? (
          <>
            <div className="mt-3 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Note</div>
            <div className="mt-1 whitespace-pre-line text-ink-900">{customerNote}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
