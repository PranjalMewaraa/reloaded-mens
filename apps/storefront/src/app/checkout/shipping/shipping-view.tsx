'use client';

// Step 2 — shipping method. Sprint 4 ships a single Standard option with fee + ETA
// derived from the customer's pincode (via PincodeContext) and the seeded Settings.
// Express + store pickup arrive in Sprint 11 when real carrier rates land.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { useCart } from '@/lib/cart-context';
import { usePincode } from '@/lib/pincode-context';
import { formatEtaDate, formatINR } from '@/lib/utils';
import { readAddress } from '../checkout-storage';

const FLAT_SHIPPING_PAISA = 9900;
const FREE_SHIP_THRESHOLD_PAISA = 199900;

export function ShippingView() {
  const router = useRouter();
  const { items, subtotalPaisa, hydrated } = useCart();
  const { serviceability } = usePincode();
  const [pincodeMissing, setPincodeMissing] = React.useState(false);

  React.useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      router.replace('/cart');
      return;
    }
    if (!readAddress()) {
      router.replace('/checkout/address');
      return;
    }
    if (!serviceability) setPincodeMissing(true);
  }, [hydrated, items.length, router, serviceability]);

  if (!hydrated) return null;
  if (items.length === 0) return null;

  const shippingPaisa = subtotalPaisa >= FREE_SHIP_THRESHOLD_PAISA ? 0 : FLAT_SHIPPING_PAISA;
  const etaMax = serviceability?.etaDaysMax ?? 5;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_5fr]">
      <section className="space-y-3">
        <div className="rounded-2xl border-2 border-ink-900 bg-snow p-5">
          <div className="flex items-start gap-3">
            <Truck className="mt-1 h-5 w-5 text-ink-900" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-ink-900">Standard delivery</span>
                <span className="font-mono text-[13px] text-ink-900">
                  {shippingPaisa === 0 ? 'Free' : formatINR(shippingPaisa)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Delivered by {formatEtaDate(etaMax)} · 3–5 business days
              </p>
              {pincodeMissing ? (
                <p className="mt-2 text-[11.5px] text-warning">
                  Pincode not confirmed — delivery dates may shift after we verify yours.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone="success" withDot>
                    {serviceability?.cod ? 'COD available' : 'Prepaid only'}
                  </Pill>
                  <Pill tone="neutral">14-day returns</Pill>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-[12px] text-ink-500">
          Express + store pickup are coming once we have a real carrier wired (Sprint 11).
        </p>
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Button size="lg" className="w-full" onClick={() => router.push('/checkout/payment')}>
          Continue to payment
        </Button>
        <Button
          variant="ghost"
          size="md"
          className="mt-2 w-full"
          onClick={() => router.push('/checkout/address')}
        >
          Edit address
        </Button>
      </aside>
    </div>
  );
}
