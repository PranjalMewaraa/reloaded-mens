'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePincode } from '@/lib/pincode-context';

interface PincodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // First-visit modal hides the "Skip" button so the customer is gently nudged to set a
  // pincode. Header-triggered modal allows skipping.
  allowSkip?: boolean;
}

// First-visit modal + header-triggered "change pincode" modal. Two paths through one
// component to keep the validation + serviceability response handling in one place.
export function PincodeModal({ open, onOpenChange, allowSkip = true }: PincodeModalProps) {
  const { setPincode } = usePincode();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setResultMessage(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultMessage(null);
    if (!/^[1-9]\d{5}$/.test(value)) {
      setError('Enter a valid 6-digit Indian pincode');
      return;
    }
    setSubmitting(true);
    const result = await setPincode(value);
    setSubmitting(false);
    if (!result) {
      setError('Could not check serviceability. Try again.');
      return;
    }
    if (result.serviceable) {
      // Brief success state so the customer sees confirmation, then close.
      setResultMessage(`Great — we ship to ${value}. Closing…`);
      window.setTimeout(() => onOpenChange(false), 700);
    } else {
      // Keep the modal open with the not-serviceable copy so they can try another pincode.
      setError(`We don't ship to ${value} yet. Try another, or shop in-store-only items.`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Where should we ship?</DialogTitle>
          <DialogDescription>
            Drop your pincode and we&apos;ll show accurate delivery dates as you shop.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="flex items-center gap-3 rounded-md border border-ink-200 bg-snow px-3.5 focus-within:border-ink-900">
            <MapPin className="h-4 w-4 text-ink-400" aria-hidden />
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="560078"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
              className="h-12 border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Pincode"
              autoFocus
            />
          </label>
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          {resultMessage ? <p className="text-[12px] text-success">{resultMessage}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {allowSkip ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Skip for now
              </Button>
            ) : null}
            <Button type="submit" size="md" disabled={submitting || value.length !== 6}>
              {submitting ? 'Checking…' : 'Save pincode'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Sits inside the shell layout — opens once per visitor if no pincode is stored,
// BUT only on PDP routes (`/p/<slug>`). Pincode is only required when the user
// is actually considering a purchase; prompting on home / shop / category pages
// reads as friction. The component still mounts globally so the cross-page
// "prompted" state persists, but the open() decision is gated by pathname.
export function FirstVisitPincodePrompt() {
  const { pincode } = usePincode();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [prompted, setPrompted] = React.useState(false);

  // Wait one tick after mount so the provider has a chance to hydrate from localStorage
  // before we decide to open the modal. Otherwise the modal would flash on every page
  // load for returning customers.
  React.useEffect(() => {
    const id = window.setTimeout(() => setHydrated(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  React.useEffect(() => {
    if (!hydrated || prompted) return;
    // Only prompt on product detail pages. The `/p/` prefix is the PDP route
    // segment (see apps/storefront/src/app/p/[slug]/). Any other route — home,
    // /shop, /c/*, /search, /account, /cart, /checkout — skips the prompt
    // (checkout has its own address form that captures pincode inline).
    const isPdp = pathname?.startsWith('/p/') ?? false;
    if (!isPdp) return;
    if (!pincode) {
      setOpen(true);
      setPrompted(true);
    }
  }, [hydrated, prompted, pincode, pathname]);

  return <PincodeModal open={open} onOpenChange={setOpen} allowSkip />;
}
