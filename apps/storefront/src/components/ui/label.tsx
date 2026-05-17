import * as React from 'react';
import { cn } from '@/lib/utils';

// Storefront uses a plain semantic <label> — no Radix dependency to keep the
// bundle small. Same visual spec as the admin Label for consistency.
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn(
          'mb-1 block font-mono text-[10.5px] uppercase tracking-caps text-ink-500',
          className,
        )}
        {...props}
      />
    );
  },
);
