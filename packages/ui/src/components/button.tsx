import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

// Minimal Button placeholder. The real component arrives once the Figma design
// foundations land in Sprint 1–2 of the storefront work. Keep this here just to
// prove the package wiring is end-to-end.

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'disabled:pointer-events-none disabled:opacity-50',
          variant === 'primary' && 'bg-neutral-900 text-white hover:bg-neutral-800',
          variant === 'secondary' &&
            'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
          variant === 'ghost' && 'text-neutral-900 hover:bg-neutral-100',
          size === 'sm' && 'h-8 px-3 text-sm',
          size === 'md' && 'h-11 px-4 text-base',
          size === 'lg' && 'h-13 px-6 text-base',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
