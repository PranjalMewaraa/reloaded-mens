import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format paisa as INR with locale-aware thousand separators. Storefront always shows
// integer rupees — paise is server-side only.
export function formatINR(paisa: number | null | undefined): string {
  if (paisa == null) return '';
  return `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
}

// "Tue, 21 May" — used by the delivery estimate widget. ETA always rendered in IST.
export function formatEtaDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}
