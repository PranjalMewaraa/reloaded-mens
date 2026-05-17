import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CheckoutProgress } from './checkout-progress';
import { env } from '@/lib/env';

// Minimal checkout shell — no header/footer/bottom-nav from the main store shell.
// The store-shell client component already detects /checkout/* and renders only the
// children + Toaster; this layout adds the progress bar + back-to-cart link.

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-5 py-4 md:px-8 md:py-6">
      <header className="flex items-center justify-between">
        <Link href="/cart" className="inline-flex items-center gap-1 text-[12.5px] text-ink-500 hover:text-ink-900">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to bag
        </Link>
        <Link href="/" className="font-display text-[22px] font-semibold tracking-tight text-ink-900">
          {env.NEXT_PUBLIC_BRAND_NAME}.
        </Link>
        <span className="w-12" aria-hidden />
      </header>
      <CheckoutProgress />
      <div className="mt-6 flex-1">{children}</div>
    </div>
  );
}
