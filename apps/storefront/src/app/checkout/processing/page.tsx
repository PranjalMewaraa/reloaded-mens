import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ProcessingView } from './processing-view';

export const metadata = { title: 'Processing payment' };

// Next.js 15 requires useSearchParams() to live inside a Suspense boundary so the route
// can statically render the fallback while waiting on client-only params to resolve.
export default function CheckoutProcessingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-ink-900" aria-hidden />
          <p className="text-[12.5px] text-ink-500">Connecting…</p>
        </div>
      }
    >
      <ProcessingView />
    </Suspense>
  );
}
