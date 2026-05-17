'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'address', label: '1 · Address' },
  { key: 'shipping', label: '2 · Shipping' },
  { key: 'payment', label: '3 · Payment' },
];

// 3-step progress bar shown at the top of every checkout page (except processing/success
// which sit outside the funnel and don't need the indicator).
export function CheckoutProgress() {
  const pathname = usePathname();
  const activeIdx = STEPS.findIndex((s) => pathname?.includes(`/checkout/${s.key}`));
  // /processing or /success — collapse the bar so it doesn't show a confusing state.
  if (activeIdx === -1) return null;
  const progressPct = ((activeIdx + 1) / STEPS.length) * 100;
  return (
    <div className="mt-6">
      <ol className="flex items-center justify-between text-ink-500">
        {STEPS.map((step, idx) => (
          <li
            key={step.key}
            className={cn(
              'font-mono text-[10.5px] uppercase tracking-caps',
              idx === activeIdx ? 'text-ink-900' : idx < activeIdx ? 'text-ink-700' : 'text-ink-400',
            )}
          >
            {step.label}
          </li>
        ))}
      </ol>
      <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full bg-ink-900 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
