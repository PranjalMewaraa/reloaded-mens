'use client';

// Cart state lives client-side only this sprint — localStorage with a 7-day TTL.
// Sprint 13 will mirror to a server-side Cart table when abandoned-cart recovery
// needs the data. Today the order-create POST receives the full payload from here.

import * as React from 'react';

const STORAGE_KEY = 'reloaded.cart.v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CartItem {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string | null; // "M · Black"
  sku: string;
  primaryImageUrl: string | null;
  unitPricePaisa: number;
  quantity: number;
}

interface StoredCart {
  items: CartItem[];
  storedAt: number;
}

interface CartContextValue {
  hydrated: boolean;
  items: CartItem[];
  totalQuantity: number;
  subtotalPaisa: number;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate from localStorage once. Drops the cart if older than TTL so stale prices
  // don't haunt returning visitors.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredCart;
        if (parsed && Array.isArray(parsed.items) && Date.now() - parsed.storedAt <= TTL_MS) {
          setItems(parsed.items);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist on every change once hydrated. Skipping pre-hydration writes prevents the
  // first render from wiping a returning visitor's cart with an empty array.
  React.useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
    try {
      const payload: StoredCart = { items, storedAt: Date.now() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage disabled — keep the in-memory state working anyway.
    }
  }, [items, hydrated]);

  const addItem = React.useCallback(
    (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      const delta = Math.max(1, item.quantity ?? 1);
      setItems((current) => {
        const existing = current.find((i) => i.variantId === item.variantId);
        if (existing) {
          // Cap at 20 per line — matches cartItemPayloadSchema's server-side limit.
          const next = Math.min(20, existing.quantity + delta);
          return current.map((i) =>
            i.variantId === item.variantId ? { ...i, quantity: next } : i,
          );
        }
        const { quantity: _q, ...rest } = item;
        return [...current, { ...rest, quantity: Math.min(20, delta) }];
      });
    },
    [],
  );

  const updateQuantity = React.useCallback((variantId: string, quantity: number) => {
    setItems((current) => {
      if (quantity <= 0) return current.filter((i) => i.variantId !== variantId);
      const capped = Math.min(20, quantity);
      return current.map((i) => (i.variantId === variantId ? { ...i, quantity: capped } : i));
    });
  }, []);

  const removeItem = React.useCallback((variantId: string) => {
    setItems((current) => current.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  const subtotalPaisa = items.reduce((s, i) => s + i.unitPricePaisa * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ hydrated, items, totalQuantity, subtotalPaisa, addItem, updateQuantity, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error('useCart() must be called inside <CartProvider>');
  return ctx;
}
