'use client';

// Lands here after POST /public/orders returns. Polls the mock provider's status until
// it flips to captured or failed, then routes to /checkout/success or back to /payment.
// Stops polling after 60s to prevent runaway loops if the provider misbehaves.

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearCheckout } from '../checkout-storage';
import { pollPaymentSession, CheckoutError } from '@/lib/checkout-api';

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_MS = 60_000;

export function ProcessingView() {
  const router = useRouter();
  const sp = useSearchParams();
  const sessionId = sp.get('session');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sessionId) {
      router.replace('/checkout/payment');
      return;
    }
    let cancelled = false;
    const start = Date.now();
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const status = await pollPaymentSession(sessionId);
        if (cancelled) return;
        if (status.status === 'captured' && status.orderNumber) {
          // Successful — drop the checkout blob and route to success. The cart is
          // cleared on the success page itself once we render.
          router.replace(`/checkout/success/${encodeURIComponent(status.orderNumber)}`);
          return;
        }
        if (status.status === 'failed') {
          setError('Payment failed. Try again or pick a different method.');
          // Keep the idempotency key + address so the retry doesn't double-charge.
          return;
        }
      } catch (err) {
        if (err instanceof CheckoutError && err.status === 404) {
          setError('Payment session expired. Please start checkout again.');
          clearCheckout();
          return;
        }
        // Network blips — keep polling until the deadline.
      }
      if (Date.now() - start > POLL_MAX_MS) {
        setError(
          "We didn't hear back from the payment provider. Check your inbox for a confirmation or contact us.",
        );
        return;
      }
      timeout = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [router, sessionId]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      {error ? (
        <>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink-900">
            Payment didn&apos;t go through
          </h1>
          <p className="text-[13px] text-ink-500">{error}</p>
          <div className="mt-2 flex gap-2">
            <Button onClick={() => router.replace('/checkout/payment')}>Try again</Button>
            <Button variant="ghost" onClick={() => router.replace('/cart')}>
              Back to bag
            </Button>
          </div>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-ink-900" aria-hidden />
          <h1 className="font-display text-[24px] font-semibold tracking-tight text-ink-900">
            Talking to the payment provider…
          </h1>
          <p className="text-[12.5px] text-ink-500">
            Hold tight. We&apos;ll route you to confirmation in a few seconds.
          </p>
        </>
      )}
    </div>
  );
}
