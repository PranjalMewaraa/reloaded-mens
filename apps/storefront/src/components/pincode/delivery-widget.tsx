'use client';

// Three-state delivery widget for the PDP. Renders inline below the variant picker.
// State machine (driven by PincodeContext):
//   pincode == null              → "enter pincode" form
//   serviceable === true         → success state with ETA + free-ship hint
//   serviceable === false / null → not-serviceable state with try-another + WhatsApp

import * as React from 'react';
import { AlertCircle, MessageCircle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { env } from '@/lib/env';
import { usePincode } from '@/lib/pincode-context';
import { cn, formatEtaDate, formatINR } from '@/lib/utils';

export function DeliveryWidget({ className }: { className?: string }) {
  const { pincode, serviceability, loading, setPincode, clearPincode } = usePincode();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[1-9]\d{5}$/.test(value)) {
      setError('Enter a valid 6-digit pincode');
      return;
    }
    const result = await setPincode(value);
    if (!result) setError('Could not check serviceability. Try again.');
    setValue('');
  }

  if (!pincode) {
    return (
      <div className={cn('rounded-md border border-ink-200 bg-snow p-4', className)}>
        <p className="text-[12.5px] font-medium text-ink-900">Enter pincode to see delivery date</p>
        <form onSubmit={submit} className="mt-2.5 flex gap-2">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="560078"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
            aria-label="Pincode"
            className="h-10"
          />
          <Button type="submit" size="sm" disabled={loading || value.length !== 6}>
            {loading ? 'Checking…' : 'Check'}
          </Button>
        </form>
        {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-400">
          Free shipping over ₹1,499 · COD available
        </p>
      </div>
    );
  }

  if (serviceability?.serviceable) {
    const etaMax = serviceability.etaDaysMax ?? 5;
    return (
      <div className={cn('rounded-md border border-success/30 bg-success/5 p-4', className)}>
        <div className="flex items-start gap-2.5">
          <Truck className="mt-0.5 h-4 w-4 text-success" />
          <div className="flex-1">
            <p className="text-[12.5px] font-medium text-success">
              Free delivery by {formatEtaDate(etaMax)}
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-700">
              {serviceability.cod ? 'COD available' : 'Prepaid only'}
              {serviceability.freeShippingThresholdPaisa
                ? ` · Free shipping over ${formatINR(serviceability.freeShippingThresholdPaisa)}`
                : ''}{' '}
              · 14-day returns
            </p>
            <button
              type="button"
              onClick={clearPincode}
              className="mt-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-500 underline-offset-2 hover:underline"
            >
              Delivering to {pincode} · change
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not serviceable (or check failed)
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    `Hi! Can you ship to ${pincode}?`,
  )}`;
  return (
    <div className={cn('rounded-md border border-danger/30 bg-danger/5 p-4', className)}>
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 text-danger" />
        <div className="flex-1">
          <p className="text-[12.5px] font-medium text-danger">
            We don&apos;t ship to {pincode} yet
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-700">
            We&apos;re adding new pincodes every quarter. Try another pincode, or message us — we
            can sometimes arrange courier.
          </p>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Try another"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
              className="h-9"
              aria-label="Pincode"
            />
            <Button type="submit" size="sm" disabled={loading || value.length !== 6}>
              Check
            </Button>
          </form>
          {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex items-center gap-2 text-[12px] text-whatsapp underline-offset-4 hover:underline"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Message us on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
