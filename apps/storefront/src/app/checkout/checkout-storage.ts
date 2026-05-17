'use client';

// Tiny client-side storage helper shared by the checkout steps. Stashes the address
// + chosen coupon + idempotency key so retries reuse the same state and the customer
// can refresh between steps without losing their input.
//
// Lives in sessionStorage (not localStorage) so it auto-clears when the customer closes
// the tab — leftover checkout data shouldn't linger.

import { v4 as uuid } from 'uuid';
import type { ShippingAddress } from '@repo/types';

const ADDRESS_KEY = 'reloaded.checkout.address.v1';
const COUPON_KEY = 'reloaded.checkout.coupon.v1';
const IDEMPOTENCY_KEY = 'reloaded.checkout.idempotency.v1';
const CONTACT_KEY = 'reloaded.checkout.contact.v1';

export interface CheckoutContact {
  name: string;
  phone: string;
  email?: string;
}

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage full / disabled — checkout still works in-memory.
  }
}

function remove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function readAddress(): ShippingAddress | null {
  return read<ShippingAddress>(ADDRESS_KEY);
}

export function writeAddress(addr: ShippingAddress): void {
  write(ADDRESS_KEY, addr);
}

export function readContact(): CheckoutContact | null {
  return read<CheckoutContact>(CONTACT_KEY);
}

export function writeContact(contact: CheckoutContact): void {
  write(CONTACT_KEY, contact);
}

export function readCoupon(): { code: string } | null {
  const blob = read<{ couponCode: string | null; savedAt: number }>(COUPON_KEY);
  return blob?.couponCode ? { code: blob.couponCode } : null;
}

export function clearCoupon(): void {
  remove(COUPON_KEY);
}

/** Stable per-attempt idempotency key. Same key is reused if the customer retries on
 *  the payment step. Resets only when checkout completes successfully (clearCheckout). */
export function getOrCreateIdempotencyKey(): string {
  const existing = read<string>(IDEMPOTENCY_KEY);
  if (existing) return existing;
  const next = uuid();
  write(IDEMPOTENCY_KEY, next);
  return next;
}

export function clearCheckout(): void {
  remove(ADDRESS_KEY);
  remove(CONTACT_KEY);
  remove(COUPON_KEY);
  remove(IDEMPOTENCY_KEY);
}
