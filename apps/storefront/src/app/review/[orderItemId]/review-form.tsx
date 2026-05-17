'use client';

import * as React from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import type { ReviewSubmissionPrompt } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { env } from '@/lib/env';

interface Props {
  orderItemId: string;
  token: string;
  initial: ReviewSubmissionPrompt;
}

export function ReviewForm({ orderItemId, token, initial }: Props) {
  const [submitted, setSubmitted] = React.useState(initial.alreadySubmitted);
  const [rating, setRating] = React.useState<number>(initial.submittedRating ?? 0);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError('Pick at least one star.');
      return;
    }
    if (title.trim().length === 0) {
      setError('Add a short title.');
      return;
    }
    if (body.trim().length < 10) {
      setError('Tell us a little more (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      const query = new URLSearchParams({ orderItemId, t: token });
      const res = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/public/reviews/submit?${query.toString()}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rating, title: title.trim(), body: body.trim() }),
        },
      );
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errBody.message ?? 'Could not submit review');
      }
      setSubmitted(true);
      toast.success('Thanks — review submitted');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-5">
        <p className="text-[14px] font-medium text-success">Thanks — we&apos;ve got your review.</p>
        <p className="mt-1 text-[12.5px] text-ink-700">
          It&apos;ll appear on the product page once our team approves it. Usually within a day.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/p/${initial.productSlug}`}>See the product</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/shop">Keep shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-ink-100 bg-snow p-5">
      <div>
        <Label>Your rating</Label>
        <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hoverRating || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n} of 5 stars`}
                aria-checked={rating === n}
                role="radio"
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(n)}
                className="-m-1 p-1"
              >
                <Star
                  className={
                    'h-7 w-7 transition ' +
                    (filled ? 'fill-clay text-clay' : 'text-ink-300')
                  }
                />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="title">Headline</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Soft, well-cut, exactly what I wanted"
          maxLength={80}
        />
      </div>
      <div>
        <Label htmlFor="body">Details</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Fabric, fit, what you wear it with, anything you'd flag to a friend"
          rows={5}
          maxLength={1000}
        />
      </div>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      <Button type="submit" size="lg" variant="clay" className="w-full" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit review'}
      </Button>
      <p className="text-[11.5px] text-ink-500">
        Reviews appear on the PDP once approved by our team — usually within a day.
      </p>
    </form>
  );
}
