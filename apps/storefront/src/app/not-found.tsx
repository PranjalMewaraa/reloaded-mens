import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Page not found' };

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-[640px] flex-col items-center justify-center px-5 py-16 text-center md:px-8 md:py-24">
      <span className="label-caps">404</span>
      <h1 className="mt-3 font-display text-[40px] font-semibold tracking-tight text-ink-900 md:text-[56px]">
        We can&apos;t find that page.
      </h1>
      <p className="mt-3 max-w-[42ch] text-[14px] leading-[1.6] text-ink-600">
        It may have moved, or the link is wrong. Pick a path back, or message us on
        WhatsApp if you got here from somewhere unexpected.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/shop">Browse the shop</Link>
        </Button>
      </div>
    </div>
  );
}
