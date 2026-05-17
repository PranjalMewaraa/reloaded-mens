'use client';

// Pincode + serviceability state, shared via React context. Lives on the client because
// it depends on localStorage; the first paint happens with `pincode: null` so the
// delivery widget renders the "enter pincode" state until hydration completes.

import * as React from 'react';
import type { ServiceabilityResponse } from '@repo/types';
import { env } from './env';

const STORAGE_KEY = 'mool.pincode.v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface StoredPincode {
  pincode: string;
  storedAt: number;
}

interface PincodeContextValue {
  pincode: string | null;
  serviceability: ServiceabilityResponse | null;
  loading: boolean;
  // Returns the serviceability response (or null if validation/network failed) so the
  // caller can react inline without waiting for the next render tick.
  setPincode: (pincode: string) => Promise<ServiceabilityResponse | null>;
  clearPincode: () => void;
}

const PincodeContext = React.createContext<PincodeContextValue | null>(null);

export function PincodeProvider({ children }: { children: React.ReactNode }) {
  const [pincode, setPincodeState] = React.useState<string | null>(null);
  const [serviceability, setServiceability] = React.useState<ServiceabilityResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Hydrate from localStorage on first mount. If the entry is older than TTL we drop it
  // so the first-visit modal re-prompts.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPincode;
      if (Date.now() - parsed.storedAt > TTL_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      void refresh(parsed.pincode);
    } catch {
      // Malformed entry — clear it so we don't keep retrying on every load.
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  async function refresh(next: string): Promise<ServiceabilityResponse | null> {
    setLoading(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/public/serviceability?pincode=${encodeURIComponent(next)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setPincodeState(next);
        setServiceability(null);
        return null;
      }
      const body = (await res.json()) as ServiceabilityResponse;
      setPincodeState(next);
      setServiceability(body);
      return body;
    } catch {
      setPincodeState(next);
      setServiceability(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function setPincode(next: string): Promise<ServiceabilityResponse | null> {
    const result = await refresh(next);
    try {
      const payload: StoredPincode = { pincode: next, storedAt: Date.now() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage disabled (private mode etc.) — keep the in-memory state and
      // re-prompt on next session.
    }
    return result;
  }

  function clearPincode() {
    setPincodeState(null);
    setServiceability(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <PincodeContext.Provider value={{ pincode, serviceability, loading, setPincode, clearPincode }}>
      {children}
    </PincodeContext.Provider>
  );
}

export function usePincode(): PincodeContextValue {
  const ctx = React.useContext(PincodeContext);
  if (!ctx) throw new Error('usePincode() must be called inside <PincodeProvider>');
  return ctx;
}
