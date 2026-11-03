'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bone px-6 text-center">
      <p className="text-[15px] font-medium text-ink-900">Something went wrong loading this page.</p>
      <p className="text-[13px] text-ink-500">The server may be busy. You are still signed in.</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
