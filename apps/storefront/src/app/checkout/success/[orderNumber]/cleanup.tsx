'use client';

// Tiny client component mounted on the success page. Clears the cart + checkout blobs
// once the customer reaches confirmation so refreshing the page (or coming back later)
// doesn't show a stale bag.

import * as React from 'react';
import { useCart } from '@/lib/cart-context';
import { clearCheckout } from '../../checkout-storage';

export function OrderSuccessCleanup() {
  const { clear } = useCart();
  React.useEffect(() => {
    clear();
    clearCheckout();
  }, [clear]);
  return null;
}
