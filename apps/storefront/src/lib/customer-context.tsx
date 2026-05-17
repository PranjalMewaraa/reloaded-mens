'use client';

// Tiny customer-session context. Fetches /customer-auth/me once on mount, exposes
// useCustomer() hook to client components (header, account pages, /track route
// fallback). The session is the source of truth — server-side pages read the
// cookie themselves via lib/customer-server.

import * as React from 'react';
import type { CustomerProfile } from '@repo/types';
import { fetchMe } from './customer-api';

interface CustomerContextValue {
  customer: CustomerProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setCustomer: (next: CustomerProfile | null) => void;
}

const CustomerContext = React.createContext<CustomerContextValue | undefined>(undefined);

export function CustomerProvider({
  initial,
  children,
}: {
  initial: CustomerProfile | null;
  children: React.ReactNode;
}) {
  const [customer, setCustomer] = React.useState<CustomerProfile | null>(initial);
  const [loading, setLoading] = React.useState(initial === null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchMe();
      setCustomer(next);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on mount when the SSR snapshot was null — the cookie might exist
  // anyway (e.g. the user just logged in and the page didn't re-render server
  // side yet).
  React.useEffect(() => {
    if (initial === null) {
      void refresh();
    }
    // initial intentionally omitted — only run once on mount.
  }, [refresh]);

  const value = React.useMemo<CustomerContextValue>(
    () => ({ customer, loading, refresh, setCustomer }),
    [customer, loading, refresh],
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerContextValue {
  const ctx = React.useContext(CustomerContext);
  if (!ctx) {
    throw new Error('useCustomer must be used within CustomerProvider');
  }
  return ctx;
}
