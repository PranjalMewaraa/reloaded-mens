import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface StaticPageProps {
  title: string;
  intro?: string;
  children: React.ReactNode;
  breadcrumb?: string;
}

// Shared shell for legal / help / size-guide / contact pages. Kept intentionally simple —
// content owners can drop Markdown-rendered children once we add MDX in a later sprint.
export function StaticPage({ title, intro, children, breadcrumb }: StaticPageProps) {
  return (
    <div className="mx-auto w-full max-w-[840px] px-5 py-6 md:px-8 md:py-10">
      <nav className="label-caps flex items-center gap-1.5" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink-900">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-ink-300" aria-hidden />
        <span className="text-ink-900">{breadcrumb ?? title}</span>
      </nav>
      <h1 className="mt-3 font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[40px]">
        {title}
      </h1>
      {intro ? (
        <p className="mt-3 max-w-[65ch] text-[14px] leading-[1.7] text-ink-600">{intro}</p>
      ) : null}
      <article className="prose prose-ink mt-8 max-w-none space-y-4 text-[14px] leading-[1.75] text-ink-700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-ink-900 [&_a]:underline-offset-4 [&_a]:text-ink-900 [&_a:hover]:underline">
        {children}
      </article>
    </div>
  );
}
