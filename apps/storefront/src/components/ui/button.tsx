import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// MOOL storefront buttons:
// - primary  : ink-900 / snow — most CTAs (Add to bag is clay; see variant)
// - outline  : hairline border, ink-900 text
// - clay     : the "shop the drop" / "Add to bag" hero CTA
// - whatsapp : in-store-only chat-to-book CTA
// - ghost    : minimal pill, used in nav
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink-900 text-snow hover:bg-ink-700',
        outline: 'border border-ink-200 bg-snow text-ink-900 hover:bg-ink-50',
        clay: 'bg-clay text-snow hover:bg-clay-700',
        moss: 'bg-moss text-snow hover:opacity-90',
        whatsapp: 'bg-whatsapp text-snow hover:opacity-90',
        ghost: 'text-ink-900 hover:bg-ink-50',
        link: 'text-ink-900 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3.5 text-[12.5px]',
        md: 'h-11 px-5 text-[13px]',
        lg: 'h-12 px-6 text-[14px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
