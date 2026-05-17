'use client';

import * as React from 'react';
import { ChevronDown, Star } from 'lucide-react';
import type { ProductReviewsResponse, ReviewListItem } from '@repo/types';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

interface Props {
  productSlug: string;
  averageRating: number | null;
  reviewCount: number;
}

type Sort = 'recent' | 'highest' | 'lowest';

const PAGE_SIZE = 5;

export function ReviewsSection({ productSlug, averageRating, reviewCount }: Props) {
  const [reviews, setReviews] = React.useState<ReviewListItem[]>([]);
  const [histogram, setHistogram] = React.useState<ProductReviewsResponse['histogram'] | null>(null);
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<Sort>('recent');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState(reviewCount);

  const reset = React.useCallback(() => {
    setReviews([]);
    setPage(0);
  }, []);

  async function loadPage(nextPage: number, replace: boolean) {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
        sort,
      });
      const res = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/public/products/${encodeURIComponent(productSlug)}/reviews?${query.toString()}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('Failed to load reviews');
      const data = (await res.json()) as ProductReviewsResponse;
      setHistogram(data.histogram);
      setTotal(data.totalCount);
      setReviews((prev) => (replace ? data.items : [...prev, ...data.items]));
      setPage(nextPage);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Initial load. Re-fires on sort change.
  React.useEffect(() => {
    reset();
    void loadPage(1, true);
    // sort intentional dep; reset+loadPage stable enough.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    productSlug;
  }, [sort, productSlug, reset]);

  if (reviewCount === 0 && total === 0) {
    return (
      <section className="border-t border-ink-100 px-5 py-10 md:px-8 md:py-14">
        <h2 className="font-display text-[24px] font-semibold tracking-tight text-ink-900">
          Reviews
        </h2>
        <p className="mt-2 text-[13px] text-ink-500">
          No reviews yet — you could be the first to leave one after delivery.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-ink-100 px-5 py-10 md:px-8 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[24px] font-semibold tracking-tight text-ink-900">
            Reviews
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <Stars value={Math.round(averageRating ?? 0)} />
            <span className="font-mono text-[13px] text-ink-900">
              {(averageRating ?? 0).toFixed(1)}
            </span>
            <span className="text-[12.5px] text-ink-500">· {total} review{total === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 appearance-none rounded-md border border-ink-200 bg-snow pl-3 pr-9 text-[13px] text-ink-900"
            aria-label="Sort reviews"
          >
            <option value="recent">Most recent</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        </div>
      </div>

      {histogram ? (
        <div className="mt-4 max-w-md space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = histogram[star as 5 | 4 | 3 | 2 | 1];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-[12px] text-ink-700">
                <span className="w-6 font-mono">{star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-clay" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right font-mono text-[11px] text-ink-500">{count}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <ul className="mt-6 divide-y divide-ink-100">
        {reviews.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-center gap-2">
              <Stars value={r.rating} />
              <span className="text-[14px] font-medium text-ink-900">{r.title}</span>
            </div>
            <p className="mt-1 text-[13px] leading-[1.6] text-ink-700">{r.body}</p>
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
              {r.authorName} · {new Date(r.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}

      {reviews.length < total ? (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPage(page + 1, false)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={'h-4 w-4 ' + (n <= value ? 'fill-clay text-clay' : 'fill-ink-100 text-ink-200')}
        />
      ))}
    </span>
  );
}
