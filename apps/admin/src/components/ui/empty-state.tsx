import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  iconClassName?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  iconClassName,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-2xl border border-ink-100 bg-snow px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-50 text-ink-500',
            iconClassName,
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-[16px] font-semibold text-ink-900">{title}</h3>
      {description ? (
        <p className="max-w-sm text-[12.5px] leading-[1.55] text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
