'use client';

// Top-level client shell. Holds the "change pincode" modal state so the header can pop it
// open from anywhere, and wraps everything in PincodeProvider so all descendants can read
// the current pincode + serviceability. Server Components can still render as children
// (this is the Next.js App Router pattern).

import * as React from 'react';
import { Toaster } from 'sonner';
import { usePathname } from 'next/navigation';
import { BottomNav } from './bottom-nav';
import { Footer } from './footer';
import { Header } from './header';
import { FirstVisitPincodePrompt, PincodeModal } from '@/components/pincode/pincode-modal';
import { CartProvider } from '@/lib/cart-context';
import { PincodeProvider } from '@/lib/pincode-context';

interface StoreShellProps {
  children: React.ReactNode;
  navCategories: Array<{ slug: string; name: string }>;
}

export function StoreShell({ children, navCategories }: StoreShellProps) {
  return (
    <PincodeProvider>
      <CartProvider>
        <Inner navCategories={navCategories}>{children}</Inner>
      </CartProvider>
    </PincodeProvider>
  );
}

function Inner({
  children,
  navCategories,
}: {
  children: React.ReactNode;
  navCategories: Array<{ slug: string; name: string }>;
}) {
  const [pincodeOpen, setPincodeOpen] = React.useState(false);
  // Checkout routes get a minimalist shell — no header/footer/bottom-nav distraction.
  // /checkout/* renders its own progress bar via the checkout layout.
  const pathname = usePathname();
  const isCheckout = pathname?.startsWith('/checkout') ?? false;

  if (isCheckout) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
        <PincodeModal open={pincodeOpen} onOpenChange={setPincodeOpen} allowSkip />
        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header navCategories={navCategories} onChangePincode={() => setPincodeOpen(true)} />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
      <PincodeModal open={pincodeOpen} onOpenChange={setPincodeOpen} allowSkip />
      <FirstVisitPincodePrompt />
      <Toaster richColors position="top-right" />
    </div>
  );
}
