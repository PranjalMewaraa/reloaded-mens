import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const pillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-caps leading-none',
  {
    variants: {
      tone: {
        ink: 'bg-ink-900 text-snow',
        clay: 'bg-clay text-snow',
        moss: 'bg-moss text-snow',
        warning: 'bg-warning-100 text-warning',
        success: 'bg-success-100 text-success',
        danger: 'bg-danger-100 text-danger',
        info: 'bg-info-100 text-info',
        neutral: 'bg-ink-50 text-ink-900',
        snow: 'bg-snow/85 text-ink-900 backdrop-blur-sm',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

interface PillProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  withDot?: boolean;
}

const dotVariants = cva('inline-block h-1.5 w-1.5 rounded-full', {
  variants: {
    tone: {
      ink: 'bg-snow',
      clay: 'bg-snow',
      moss: 'bg-snow',
      warning: 'bg-warning',
      success: 'bg-success',
      danger: 'bg-danger',
      info: 'bg-info',
      neutral: 'bg-ink-400',
      snow: 'bg-ink-900',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Pill({ tone = 'neutral', withDot, className, children, ...props }: PillProps) {
  return (
    <span className={cn(pillVariants({ tone }), className)} {...props}>
      {withDot ? <span className={dotVariants({ tone })} /> : null}
      {children}
    </span>
  );
}
