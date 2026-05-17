import * as React from 'react';
import { cn } from '@/lib/utils';

// Storefront textarea — mirrors the input primitive (h-12 baseline, MOOL rounded-md,
// hairline border) but with min-height + resize-y for multi-line input.
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-ink-200 bg-snow px-4 py-3 text-[14px] text-ink-900',
        'placeholder:text-ink-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-1 focus-visible:ring-offset-bone',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
