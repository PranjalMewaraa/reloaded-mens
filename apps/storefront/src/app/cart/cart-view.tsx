'use client';

// Cart UI — line items, qty steppers, coupon entry, totals, free-shipping nudge.
// All state lives in the CartProvider; promotions are evaluated against the Sprint 7
// /cart/evaluate endpoint which applies automatic + coupon-gated promotions in one shot.

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CartEvaluateDiscountLine, CartEvaluateResponse } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { EmptyState } from '@/components/product/empty-state';
import { useCart } from '@/lib/cart-context';
import { evaluateCart } from '@/lib/checkout-api';
import { formatINR } from '@/lib/utils';
import { clearCoupon, readCoupon } from '../checkout/checkout-storage';

// Free-shipping threshold mirrors Settings['shipping.free_threshold_paisa']. The
// nudge is a hint; the authoritative total comes from /cart/evaluate which also
// applies any automatic promotions (e.g. "Launch week 10% off").
const FREE_SHIP_THRESHOLD_PAISA = 199900;
const FLAT_SHIPPING_PAISA = 9900;

const COUPON_STATUS_MESSAGES: Record<string, string> = {
  invalid: 'No matching offer for this code.',
  expired: 'This code has expired.',
  limit_reached: 'This code has reached its usage limit.',
  wrong_cart: "This code doesn't apply to your cart.",
  inactive_promotion: 'This code is no longer active.',
};

export function CartView() {
  const router = useRouter();
  const { items, subtotalPaisa, updateQuantity, removeItem, hydrated } = useCart();
  const [couponInput, setCouponInput] = React.useState('');
  const [appliedCode, setAppliedCode] = React.useState<string | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [couponLoading, setCouponLoading] = React.useState(false);
  const [evaluation, setEvaluation] = React.useState<CartEvaluateResponse | null>(null);

  // Restore a previously-applied coupon if the customer is bouncing around the funnel.
  // Runs only when hydrated flips true — appliedCode is intentionally omitted.
  React.useEffect(() => {
    if (!hydrated) return;
    const stored = readCoupon();
    if (stored?.code) {
      setAppliedCode((current) => current ?? stored.code);
    }
  }, [hydrated]);

  const cartLines = React.useMemo(
    () => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    [items],
  );
  const cartKey = JSON.stringify(cartLines);

  React.useEffect(() => {
    if (!hydrated || items.length === 0) {
      setEvaluation(null);
      return;
    }
    let cancelled = false;
    evaluateCart({ lines: cartLines, couponCode: appliedCode ?? undefined })
      .then((result) => {
        if (cancelled) return;
        setEvaluation(result);
        if (appliedCode && result.couponStatus !== 'applied') {
          setAppliedCode(null);
          setCouponError(result.couponMessage ?? COUPON_STATUS_MESSAGES[result.couponStatus] ?? 'Coupon could not be applied.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEvaluation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cartKey, appliedCode, hydrated, items.length, cartLines]);

  if (!hydrated) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Nothing in your bag yet"
          description="Browse the new drop or pick up where you left off."
          action={
            <Button asChild>
              <Link href="/shop">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Browse the shop
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const result = await evaluateCart({ lines: cartLines, couponCode: code });
      setEvaluation(result);
      if (result.couponStatus === 'applied') {
        setAppliedCode(code);
        setCouponInput('');
        toast.success(`Coupon ${code} applied`);
      } else {
        setAppliedCode(null);
        setCouponError(result.couponMessage ?? COUPON_STATUS_MESSAGES[result.couponStatus] ?? 'Coupon could not be applied.');
      }
    } catch (err) {
      setCouponError((err as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCode(null);
    setCouponInput('');
    setCouponError(null);
    clearCoupon();
  }

  const couponDiscountLine = evaluation?.discountLines.find((l) => l.source === 'coupon') ?? null;
  const autoDiscountLines = evaluation?.discountLines.filter((l) => l.source === 'automatic') ?? [];
  const discountPaisa = evaluation?.totalDiscountPaisa ?? 0;
  const subtotalAfterDiscountPaisa = Math.max(0, subtotalPaisa - discountPaisa);
  const fallbackShipping = subtotalAfterDiscountPaisa >= FREE_SHIP_THRESHOLD_PAISA ? 0 : FLAT_SHIPPING_PAISA;
  const shippingPaisa = evaluation?.shippingPaisa ?? fallbackShipping;
  const totalPaisa = evaluation?.totalPaisa ?? subtotalAfterDiscountPaisa + shippingPaisa;
  const freeShipping = evaluation?.freeShipping ?? shippingPaisa === 0;
  const remainingForFreeShip = freeShipping ? 0 : Math.max(0, FREE_SHIP_THRESHOLD_PAISA - subtotalAfterDiscountPaisa);

  function handleCheckout() {
    try {
      const blob = {
        couponCode: appliedCode,
        savedAt: Date.now(),
      };
      window.sessionStorage.setItem('reloaded.checkout.coupon.v1', JSON.stringify(blob));
    } catch {
      // ignore
    }
    router.push('/checkout/address');
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[7fr_5fr]">
      {/* Line items */}
      <section>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.variantId}
              className="flex gap-3 rounded-2xl border border-ink-100 bg-snow p-3"
            >
              <div className="relative h-[120px] w-[90px] shrink-0 overflow-hidden rounded-md bg-ink-50">
                {item.primaryImageUrl ? (
                  <Image
                    src={item.primaryImageUrl}
                    alt={item.productName}
                    fill
                    sizes="90px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/p/${item.productSlug}`}
                  className="line-clamp-2 text-[14px] font-medium text-ink-900 hover:underline"
                >
                  {item.productName}
                </Link>
                {item.variantLabel ? (
                  <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    {item.variantLabel}
                  </span>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <QtyStepper
                    quantity={item.quantity}
                    onChange={(q) => updateQuantity(item.variantId, q)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-danger"
                    aria-label="Remove from bag"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
                <div className="mt-auto flex items-end justify-end">
                  <span className="font-display text-[16px] font-semibold text-ink-900">
                    {formatINR(item.unitPricePaisa * item.quantity)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Totals + coupon */}
      <aside className="space-y-3">
        {/* Free-ship nudge */}
        {remainingForFreeShip > 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-snow p-3">
            <div className="flex items-center justify-between text-[12.5px] font-medium text-ink-900">
              <span>Add {formatINR(remainingForFreeShip)} more for free shipping.</span>
              <span className="font-mono text-[10.5px] text-ink-500">
                {formatINR(subtotalAfterDiscountPaisa)} / {formatINR(FREE_SHIP_THRESHOLD_PAISA)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-clay"
                style={{
                  width: `${Math.min(100, (subtotalAfterDiscountPaisa / FREE_SHIP_THRESHOLD_PAISA) * 100).toFixed(1)}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/5 p-3 text-[12.5px] text-success">
            <Tag className="h-3.5 w-3.5" /> Free shipping unlocked.
          </div>
        )}

        {/* Coupon */}
        <div className="rounded-2xl border border-ink-100 bg-snow p-4">
          <div className="label-caps mb-2">Coupon</div>
          {couponDiscountLine && appliedCode ? (
            <div className="flex items-center justify-between">
              <div>
                <Pill tone="success" withDot>
                  {appliedCode}
                </Pill>
                <p className="mt-1 text-[12px] text-ink-500">
                  You save {formatINR(couponDiscountLine.amountPaisa)}.
                </p>
              </div>
              <button
                type="button"
                onClick={removeCoupon}
                className="text-[12px] text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <form className="flex gap-2" onSubmit={applyCoupon}>
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="WELCOME200"
                maxLength={40}
                aria-label="Coupon code"
                className="h-10 font-mono text-[12.5px] uppercase tracking-caps"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={couponLoading || couponInput.trim().length < 2}
              >
                {couponLoading ? '…' : 'Apply'}
              </Button>
            </form>
          )}
          {couponError ? <p className="mt-2 text-[12px] text-danger">{couponError}</p> : null}
        </div>

        {/* Totals */}
        <div className="rounded-2xl border border-ink-100 bg-snow p-4">
          <SummaryRow label={`Subtotal · ${items.length} item${items.length === 1 ? '' : 's'}`} value={formatINR(subtotalPaisa)} />
          {autoDiscountLines.map((line: CartEvaluateDiscountLine) => (
            <SummaryRow
              key={line.promotionId}
              label={line.promotionName}
              value={`− ${formatINR(line.amountPaisa)}`}
              tone="success"
            />
          ))}
          {couponDiscountLine ? (
            <SummaryRow
              label={`${couponDiscountLine.promotionName} · ${couponDiscountLine.couponCode ?? appliedCode}`}
              value={`− ${formatINR(couponDiscountLine.amountPaisa)}`}
              tone="success"
            />
          ) : null}
          <SummaryRow label="Shipping" value={shippingPaisa === 0 ? 'Free' : formatINR(shippingPaisa)} />
          <div className="my-2 border-t border-ink-100" />
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-ink-900">To pay</span>
            <span className="font-display text-[22px] font-semibold text-ink-900">
              {formatINR(totalPaisa)}
            </span>
          </div>
          <Button
            size="lg"
            variant="clay"
            className="mt-3 w-full"
            onClick={handleCheckout}
          >
            Proceed to checkout · {formatINR(totalPaisa)}
          </Button>
          <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            UPI · Cards · NetBanking
          </p>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success';
}) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span className={tone === 'success' ? 'text-success' : 'text-ink-900'}>{value}</span>
    </div>
  );
}

function QtyStepper({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-ink-200">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        className="flex h-9 w-9 items-center justify-center text-ink-700 hover:bg-ink-50 disabled:opacity-40"
        aria-label="Decrease quantity"
        disabled={quantity <= 1}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="font-mono text-[13px] tabular-nums w-8 text-center text-ink-900">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        className="flex h-9 w-9 items-center justify-center text-ink-700 hover:bg-ink-50 disabled:opacity-40"
        aria-label="Increase quantity"
        disabled={quantity >= 20}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
