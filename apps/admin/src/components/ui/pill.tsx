import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// MOOL pill: small inline status indicator with optional leading dot.
// Seven tones mirror the design system: info/success/warning/danger/neutral/ink/clay.

const pillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium leading-none',
  {
    variants: {
      tone: {
        info: 'bg-info-100 text-info',
        success: 'bg-success-100 text-success',
        warning: 'bg-warning-100 text-warning',
        danger: 'bg-danger-100 text-danger',
        neutral: 'bg-ink-50 text-ink-900',
        ink: 'bg-ink-900 text-snow',
        clay: 'bg-clay-200 text-clay-700',
        moss: 'bg-moss-100 text-moss',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

const dotVariants = cva('h-1.5 w-1.5 rounded-full', {
  variants: {
    tone: {
      info: 'bg-info',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger',
      neutral: 'bg-ink-400',
      ink: 'bg-snow',
      clay: 'bg-clay',
      moss: 'bg-moss',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

interface PillProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  withDot?: boolean;
}

export function Pill({ tone = 'neutral', withDot = false, className, children, ...props }: PillProps) {
  return (
    <span className={cn(pillVariants({ tone }), className)} {...props}>
      {withDot ? <span className={dotVariants({ tone })} /> : null}
      {children}
    </span>
  );
}

// Badge is a thin alias kept for shadcn API compatibility — same primitive, different name.
export const Badge = Pill;
