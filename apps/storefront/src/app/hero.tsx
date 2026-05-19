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
// Hero images are static assets in `apps/storefront/public/hero/`. Next serves
// `/public/*` at the site root, so referencing them by absolute path works
// without remotePatterns config. Swap the files in-place to update the hero —
// keep the same filenames so no code change is needed.
const HERO_IMAGE_1 = '/hero/hero-1.jpeg';
const HERO_IMAGE_2 = '/hero/hero-2.jpeg';

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
    // Compact padding so the hero clears in ~one viewport on a 1080p screen.
    // Grid row height is driven by the right column's min-h — keep that
    // and the card dimensions in sync (see RIGHT COLUMN note below).
    <section className="grid items-center gap-5 px-5 pb-8 pt-5 md:grid-cols-[5fr_7fr] md:gap-10 md:px-8 md:py-12">
      {/* Left column — headline + CTAs */}
      <div className="relative z-10 flex flex-col justify-center">
        <span className="label-caps">SS26 · The first drop</span>
        <h1 className="mt-2.5 font-display text-[40px] font-semibold leading-[0.98] tracking-tight text-ink-900 md:text-[64px]">
          Our latest <br className="hidden md:block" />
          offerings.
        </h1>
        <p className="mt-3.5 max-w-[42ch] text-[14px] leading-[1.5] text-ink-600 md:text-[15px]">
          Considered cuts in honest fabrics. Made for daily wear, priced without
          the middlemen. Shipped from Bengaluru.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/shop">Shop the drop</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/visit">Visit the store</Link>
          </Button>
        </div>
      </div>

      {/* RIGHT COLUMN — tilted collage.
          The cards are absolutely positioned, so the column's height is
          driven entirely by `min-h`. That floor needs to accommodate the
          taller card at its top offset, otherwise the cards visually spill
          below their container. Math, at md (column ≈ 660px wide):
            card height = 660 × 0.46 (w) × (4/3 aspect) ≈ 405px
            top-[14%] × 460 ≈ 64px offset
            bottom of card 2 ≈ 469px ≤ 480 (min-h)  ✓
          Tweaking the card width or aspect needs a matching min-h bump. */}
      <div className="relative min-h-[320px] md:min-h-[480px]">
        {/* Card 1 — back card, tilted left */}
        <div
          ref={card1Ref}
          className="absolute left-[4%] top-[4%] aspect-[3/4] w-[46%] origin-center overflow-hidden rounded-md shadow-[0_25px_60px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5 transition-transform duration-[60ms] will-change-transform"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <Image
            src={HERO_IMAGE_1}
            alt=""
            fill
            sizes="(min-width: 768px) 28vw, 50vw"
            className="object-cover"
            priority
          />
        </div>
        {/* Card 2 — front card, tilted right, overlapping the first */}
        <div
          ref={card2Ref}
          className="absolute right-[2%] top-[14%] aspect-[3/4] w-[46%] origin-center overflow-hidden rounded-md shadow-[0_25px_60px_-20px_rgba(0,0,0,0.4)] ring-1 ring-black/5 transition-transform duration-[60ms] will-change-transform"
          style={{ transform: 'rotate(5deg)' }}
        >
          <Image
            src={HERO_IMAGE_2}
            alt=""
            fill
            sizes="(min-width: 768px) 28vw, 50vw"
            className="object-cover"
            priority
          />
        </div>
      </div>
    </section>
  );
}
