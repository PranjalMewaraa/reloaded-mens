'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Two-up tilted photo collage on the right with a scroll-linked parallax that
// nudges each card a few pixels in opposite directions. Refs + direct
// style.transform writes instead of React state so we don't re-render on every
// scroll event. Reduces-motion users get the static composition.
//
// Image URLs are hardcoded placeholders for now — swap to real brand photos
// when they exist. Both must be present in next.config.ts → remotePatterns.
const HERO_IMAGE_1 =
  'https://picsum.photos/seed/reloaded-hero-1/700/900';
const HERO_IMAGE_2 =
  'https://picsum.photos/seed/reloaded-hero-2/700/900';

export function Hero() {
  const card1Ref = React.useRef<HTMLDivElement>(null);
  const card2Ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // The base rotate stays — we only animate translateY. Each card moves at
    // a different rate so they "drift apart" subtly as you scroll. Numbers
    // are intentionally small (0.08–0.12) so the effect reads as polish, not
    // a stunt.
    const apply = () => {
      const y = window.scrollY;
      const c1 = card1Ref.current;
      const c2 = card2Ref.current;
      if (c1) c1.style.transform = `rotate(-6deg) translateY(${y * -0.08}px)`;
      if (c2) c2.style.transform = `rotate(5deg) translateY(${y * 0.12}px)`;
    };
    apply();
    window.addEventListener('scroll', apply, { passive: true });
    return () => window.removeEventListener('scroll', apply);
  }, []);

  return (
    <section className="grid items-center gap-6 px-5 pb-14 pt-8 md:grid-cols-[5fr_7fr] md:gap-10 md:px-8 md:py-20">
      {/* Left column — headline + CTAs */}
      <div className="relative z-10 flex flex-col justify-center">
        <span className="label-caps">SS26 · The first drop</span>
        <h1 className="mt-3 font-display text-[44px] font-semibold leading-[0.96] tracking-tight text-ink-900 md:text-[88px]">
          Our latest <br className="hidden md:block" />
          offerings.
        </h1>
        <p className="mt-5 max-w-[42ch] text-[14px] leading-[1.55] text-ink-600 md:text-[15px]">
          Considered cuts in honest fabrics. Made for daily wear, priced without
          the middlemen. Shipped from Bengaluru.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/shop">Shop the drop</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/visit">Visit the store</Link>
          </Button>
        </div>
      </div>

      {/* Right column — tilted collage. `min-h` gives the absolute children a
          predictable footprint without us measuring; the actual cards size
          themselves via aspect-ratio. */}
      <div className="relative min-h-[420px] md:min-h-[560px]">
        {/* Card 1 — back card, tilted left */}
        <div
          ref={card1Ref}
          className="absolute left-[4%] top-[6%] aspect-[3/4] w-[58%] origin-center overflow-hidden rounded-md shadow-[0_25px_60px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5 transition-transform duration-[60ms] will-change-transform"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <Image
            src={HERO_IMAGE_1}
            alt=""
            fill
            sizes="(min-width: 768px) 35vw, 60vw"
            className="object-cover grayscale"
            priority
          />
        </div>
        {/* Card 2 — front card, tilted right, overlapping the first */}
        <div
          ref={card2Ref}
          className="absolute right-[2%] top-[22%] aspect-[3/4] w-[58%] origin-center overflow-hidden rounded-md shadow-[0_25px_60px_-20px_rgba(0,0,0,0.4)] ring-1 ring-black/5 transition-transform duration-[60ms] will-change-transform"
          style={{ transform: 'rotate(5deg)' }}
        >
          <Image
            src={HERO_IMAGE_2}
            alt=""
            fill
            sizes="(min-width: 768px) 35vw, 60vw"
            className="object-cover grayscale"
            priority
          />
        </div>
      </div>
    </section>
  );
}
