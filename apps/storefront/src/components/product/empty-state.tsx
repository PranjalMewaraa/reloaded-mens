import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-snow px-6 py-16 text-center',
        className,
      )}
    >
      <h3 className="font-display text-[20px] font-semibold tracking-tight text-ink-900">
        {title}
      </h3>
      {description ? (
        <p className="max-w-[40ch] text-[13px] leading-[1.55] text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
