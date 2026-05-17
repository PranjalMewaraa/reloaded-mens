import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs?: BreadcrumbCrumb[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

// MOOL page header: mono breadcrumbs, 26px title, optional description, right-aligned actions.
export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-ink-100 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-8 md:py-6',
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="label-caps flex flex-wrap items-center gap-1 text-ink-500" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <span key={`${crumb.label}-${idx}`} className="inline-flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="hover:text-ink-900">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'text-ink-900' : ''}>{crumb.label}</span>
                  )}
                  {!isLast ? <ChevronRight className="h-3 w-3 text-ink-300" aria-hidden /> : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        <h1 className="mt-1 truncate text-[26px] font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[13px] text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
