'use client';

// Step 3 — review + pay. Submits cart + contact + address to POST /public/orders, then
// redirects to the provider's `redirectUrl` (mock returns /checkout/processing?session=…).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { CartEvaluateResponse, CreateOrderRequest } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { useCart } from '@/lib/cart-context';
import {
  createOrder,
  CheckoutError,
  evaluateCart,
  verifyRazorpayPayment,
} from '@/lib/checkout-api';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { formatINR } from '@/lib/utils';
import {
  getOrCreateIdempotencyKey,
  readAddress,
  readContact,
  readCoupon,
} from '../checkout-storage';

const FLAT_SHIPPING_PAISA = 9900;
const FREE_SHIP_THRESHOLD_PAISA = 199900;

// Razorpay's hosted Checkout JS. Loaded lazily on the first pay click so
// non-Razorpay (mock) flows don't pay the network cost. The script attaches
// a global `Razorpay` constructor we wrap below.
const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayLoaderPromise: Promise<void> | null = null;

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  prefill?: { contact?: string; email?: string; name?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayCtor {
  new (options: RazorpayCheckoutOptions): { open: () => void };
}
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Razorpay not available'));
  if (window.Razorpay) return Promise.resolve();
  if (razorpayLoaderPromise) return razorpayLoaderPromise;
  razorpayLoaderPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayLoaderPromise = null;
      reject(new Error('Razorpay Checkout script failed to load'));
    };
    document.head.appendChild(script);
  });
  return razorpayLoaderPromise;
}

export function PaymentView() {
  const router = useRouter();
  const { items, subtotalPaisa, hydrated } = useCart();
  const [paying, setPaying] = React.useState(false);
  const [evaluation, setEvaluation] = React.useState<CartEvaluateResponse | null>(null);
  const [appliedCoupon, setAppliedCoupon] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Bounce-back guards.
  React.useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      router.replace('/cart');
      return;
    }
    if (!readAddress() || !readContact()) {
      router.replace('/checkout/address');
    }
  }, [hydrated, items.length, router]);

  // Re-evaluate the cart server-side so the totals shown here match what
  // /public/orders will charge. The API also re-runs evaluateCart at order
  // placement — this UI call is purely for display + last-chance coupon check.
  React.useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const address = readAddress();
    const contact = readContact();
    const stored = readCoupon();
    const lines = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
    let cancelled = false;
    void (async () => {
      try {
        const result = await evaluateCart({
          lines,
          couponCode: stored?.code,
          pincode: address?.pincode,
          phone: contact?.phone,
        });
        if (cancelled) return;
        setEvaluation(result);
        setAppliedCoupon(result.couponStatus === 'applied' ? stored?.code ?? null : null);
      } catch {
        if (cancelled) return;
        setEvaluation(null);
        setAppliedCoupon(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, items, subtotalPaisa]);

  if (!hydrated || items.length === 0) return null;

  const address = readAddress();
  const contact = readContact();
  if (!address || !contact) return null;

  const discountPaisa = evaluation?.totalDiscountPaisa ?? 0;
  const subtotalAfterDiscount = Math.max(0, subtotalPaisa - discountPaisa);
  const fallbackShipping = subtotalAfterDiscount >= FREE_SHIP_THRESHOLD_PAISA ? 0 : FLAT_SHIPPING_PAISA;
  const shippingPaisa = evaluation?.shippingPaisa ?? fallbackShipping;
  const totalPaisa = evaluation?.totalPaisa ?? subtotalAfterDiscount + shippingPaisa;

  async function handlePay() {
    setPaying(true);
    setError(null);
    try {
      const body: CreateOrderRequest = {
        idempotencyKey: getOrCreateIdempotencyKey(),
        contact: contact!,
        shippingAddress: address!,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        couponCode: appliedCoupon ?? undefined,
      };
      const deviceId = getOrCreateDeviceId();
      const result = await createOrder(body, deviceId);

      // Branch on provider — Razorpay opens its hosted Checkout modal here
      // and stays on this page; mock (and PhonePe later) redirect away.
      if (result.paymentSession.provider === 'razorpay') {
        await openRazorpayModal(
          result.paymentSession.checkoutPayload as RazorpayCheckoutOptions | undefined,
          result.orderNumber,
          router,
          (msg) => {
            setPaying(false);
            setError(msg);
            toast.error(msg);
          },
        );
        // openRazorpayModal handles its own state — leave paying=true until
        // the modal resolves (success → navigate, failure → callback above).
        return;
      }

      router.push(result.paymentSession.redirectUrl);
    } catch (err) {
      if (err instanceof CheckoutError && err.body.reason === 'out_of_stock') {
        const sku = err.body.sku ?? 'an item';
        const left = err.body.available ?? 0;
        toast.error(`${sku} only has ${left} left. Adjust your bag and try again.`);
        setError(`${sku} is no longer available in the quantity you requested.`);
      } else {
        toast.error((err as Error).message || 'Payment could not start');
        setError((err as Error).message);
      }
      setPaying(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_5fr]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-ink-100 bg-snow p-5">
          <h2 className="font-display text-[18px] font-semibold text-ink-900">Review</h2>
          <p className="mt-1 text-[12px] text-ink-500">Everything below is locked once payment starts.</p>

          <h3 className="mt-4 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            Delivering to
          </h3>
          <p className="mt-1 text-[13px] leading-[1.55] text-ink-900">
            {address.name}
            <br />
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ''}
            <br />
            {address.city}, {address.state}{' '}
            <span className="font-mono">{address.pincode}</span>
            <br />
            <span className="font-mono">{address.phone}</span>
          </p>

          <h3 className="mt-5 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            Bag · {items.length} item{items.length === 1 ? '' : 's'}
          </h3>
          <ul className="mt-2 divide-y divide-ink-100">
            {items.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <div className="min-w-0">
                  <div className="truncate text-ink-900">{item.productName}</div>
                  <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                    {[item.variantLabel, `qty ${item.quantity}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="font-mono text-[12.5px] text-ink-900">
                  {formatINR(item.unitPricePaisa * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {error ? (
          <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-[12.5px] text-danger">
            {error}
          </div>
        ) : null}
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-ink-100 bg-snow p-4">
          <SummaryRow label="Subtotal" value={formatINR(subtotalPaisa)} />
          {evaluation
            ? evaluation.discountLines.map((line) => (
                <SummaryRow
                  key={line.promotionId}
                  label={
                    line.source === 'coupon' && (line.couponCode ?? appliedCoupon)
                      ? `${line.promotionName} · ${line.couponCode ?? appliedCoupon}`
                      : line.promotionName
                  }
                  value={`− ${formatINR(line.amountPaisa)}`}
                  tone="success"
                />
              ))
            : null}
          <SummaryRow label="Shipping" value={shippingPaisa === 0 ? 'Free' : formatINR(shippingPaisa)} />
          <SummaryRow label="GST (incl.)" value="Included" tone="muted" />
          <div className="my-2 border-t border-ink-100" />
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-ink-900">To pay</span>
            <span className="font-display text-[22px] font-semibold text-ink-900">{formatINR(totalPaisa)}</span>
          </div>
          <Button
            variant="clay"
            size="lg"
            className="mt-3 w-full"
            onClick={handlePay}
            disabled={paying}
          >
            <Lock className="mr-2 h-4 w-4" />
            {paying ? 'Starting payment…' : `Pay ${formatINR(totalPaisa)}`}
          </Button>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Pill tone="neutral" withDot>
              <ShieldCheck className="h-3 w-3" />
              Secure payment by Razorpay
            </Pill>
          </div>
        </div>
      </aside>
    </div>
  );
}

// Open Razorpay's Checkout modal with the payload our api built. On
// successful payment the modal posts { payment_id, order_id, signature }
// back via the handler callback — we POST those to /public/payments/razorpay/verify,
// which verifies the HMAC signature server-side and transitions the order.
// On verify success, redirect to the standard success page.
//
// The modal handles its own UI for failures; if the customer dismisses it
// without paying we fall back to onError so the page can re-enable the
// button.
async function openRazorpayModal(
  payload: RazorpayCheckoutOptions | undefined,
  orderNumber: string,
  router: ReturnType<typeof useRouter>,
  onError: (msg: string) => void,
): Promise<void> {
  if (!payload || !payload.key || !payload.order_id) {
    onError('Razorpay checkout payload missing from server response');
    return;
  }
  try {
    await loadRazorpayScript();
  } catch {
    onError('Could not load the Razorpay checkout. Try again.');
    return;
  }
  const Ctor = window.Razorpay;
  if (!Ctor) {
    onError('Razorpay checkout failed to initialise');
    return;
  }
  const checkout = new Ctor({
    ...payload,
    handler: async (response) => {
      try {
        const verifyResult = await verifyRazorpayPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        if (verifyResult.ok) {
          router.push(`/checkout/success/${verifyResult.orderNumber}`);
        } else {
          onError('Payment verification failed. Please contact support.');
        }
      } catch (err) {
        onError((err as Error).message || 'Payment verification failed');
      }
    },
    modal: {
      ondismiss: () => {
        // Customer closed the modal without paying. Re-enable the pay button
        // so they can retry. The order in our DB stays in payment_pending —
        // they can re-checkout (the idempotencyKey short-circuits back to
        // the same Order).
        onError('Payment cancelled. You can retry whenever you\'re ready.');
      },
    },
  });
  checkout.open();
  // The handler / ondismiss callbacks above resolve this flow; nothing to
  // return synchronously. orderNumber is captured in closure for any
  // verification fallbacks we may add later.
  void orderNumber;
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
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span
        className={
          tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-ink-400' : 'text-ink-900'
        }
      >
        {value}
      </span>
    </div>
  );
}
