import Link from 'next/link';
import type { ReviewSubmissionPrompt } from '@repo/types';
import { publicApi } from '@/lib/api';
import { ReviewForm } from './review-form';

interface PageProps {
  params: Promise<{ orderItemId: string }>;
  searchParams?: Promise<{ t?: string }>;
}

export const metadata = { title: 'Leave a review' };

export default async function ReviewPage({ params, searchParams }: PageProps) {
  const { orderItemId } = await params;
  const sp = (await searchParams) ?? {};
  const token = sp.t ?? '';
  const query = new URLSearchParams({ orderItemId, t: token });
  const res = await publicApi<ReviewSubmissionPrompt>(`/public/reviews/submit?${query.toString()}`);

  if (!res.ok || !res.body) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-12 text-center">
        <h1 className="font-display text-[24px] font-semibold text-ink-900">
          This review link isn&apos;t valid
        </h1>
        <p className="mt-2 text-[13px] text-ink-500">
          The link may have expired or already been used. If you have a few minutes, share your
          feedback on WhatsApp instead.
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-block text-[13px] text-ink-900 underline-offset-2 hover:underline"
        >
          Contact us
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 md:py-12">
      <p className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
        Order review
      </p>
      <h1 className="mt-1 font-display text-[24px] font-semibold text-ink-900">
        How was it?
      </h1>
      <p className="mt-1 text-[13px] text-ink-500">
        Reviewing: <span className="text-ink-900">{res.body.productName}</span>
        {res.body.variantLabel ? (
          <span className="font-mono text-[11.5px] text-ink-500"> · {res.body.variantLabel}</span>
        ) : null}
      </p>
      <ReviewForm orderItemId={orderItemId} token={token} initial={res.body} />
    </div>
  );
}
