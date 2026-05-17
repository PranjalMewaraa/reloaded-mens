import * as React from 'react';
import { cn } from '@/lib/utils';

// Storefront input — h-12, rounded-md (14px), thin border. Lighter than admin's
// rounded-xl input because customer forms feel less utility-shaped.
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-12 w-full rounded-md border border-ink-200 bg-snow px-4 text-[14px] text-ink-900',
        'placeholder:text-ink-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-1 focus-visible:ring-offset-bone',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
