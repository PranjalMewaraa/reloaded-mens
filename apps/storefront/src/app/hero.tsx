'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Two-column hero. Left column carries the wordmark + subtitle + CTAs; right
// column carries two tilted photo cards with scroll-linked parallax.
//
// The wordmark intentionally extends past the left column's boundary into
// the right column's space — text is sized to be wider than the 5fr column
// at desktop widths, and `whitespace-nowrap` keeps it on one line. With
// `mix-blend-mode: difference` on white-coloured text the wordmark inverts
// against its backdrop: appears black on the bone page background, appears
// white where it crosses over the dark image cards. The transition at the
// image edges is smooth — no halo or seam.
//
// Parallax is direct ref + style.transform writes (no React state) so we
// don't re-render on every scroll frame. Reduced-motion users get the
// static composition.
const HERO_IMAGE_1 = '/hero/hero-1.jpeg';
const HERO_IMAGE_2 = '/hero/hero-2.jpeg';

export function Hero() {
  const card1Ref = React.useRef<HTMLDivElement>(null);
  const card2Ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

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
    // `isolate` creates a stacking context so the mix-blend-mode on the
    // wordmark only blends against the hero's bg + cards, not whatever the
    // page above paints. `overflow-hidden` clips the wordmark when it spills
    // past the right edge of the viewport at narrow screens.
    <section className="relative isolate overflow-hidden bg-bone">
      <div className="grid items-center gap-5 px-5 pb-8 pt-5 md:grid-cols-[5fr_7fr] md:gap-10 md:px-8 md:py-12">
        {/* Left column. min-w-0 stops the wide wordmark from forcing the
            grid column to grow past its 5fr share — fr units only respect
            content-min when min-width is auto (the default). */}
        <div className="flex min-w-0 flex-col justify-center">
          <span className="label-caps">SS26 · The first drop</span>

          {/* WORDMARK — large enough to extend past its column boundary so
              its right edge crosses into the image area. z-20 puts it above
              the cards in the section's stacking context. text-snow +
              mix-blend-mode: difference inverts the colour against whatever
              backdrop it crosses, so the type stays legible on both the
              cream page bg and the darker image cards. */}
      <div className="relative">
  {/* Overlay Layer */}
  <h1
    className="absolute z-20 mt-3 select-none font-sans font-extrabold uppercase opacity-60"
    style={{
      mixBlendMode: 'overlay',
      fontSize: 'clamp(64px, 13vw, 184px)',
      whiteSpace: 'nowrap',
      lineHeight: 0.8,
      letterSpacing: '-0.08em',
      WebkitTextStroke: '2px white',
      color: 'transparent',
    }}
  >
    Reloaded<br />Mens
  </h1>

  {/* Main Difference Layer */}
  <h1
    className="relative z-30 mt-3 select-none font-sans font-extrabold uppercase"
    style={{
      mixBlendMode: 'difference',
      fontSize: 'clamp(64px, 13vw, 184px)',
      whiteSpace: 'nowrap',
      lineHeight: 0.8,
      letterSpacing: '-0.08em',
      WebkitTextStroke: '1.5px white',
      color: 'white',
    }}
  >
    Reloaded<br />Mens
  </h1>
</div>

          {/* Subtitle + CTAs — stay inside the column (max-w on the paragraph
              keeps them from running into the image area). z-30 so they sit
              above the wordmark's mix-blend layer (otherwise the buttons
              would also get inverted where they overlap). */}
          <div className="relative z-30">
            <p className="mt-3.5 max-w-[42ch] text-[14px] leading-[1.5] text-ink-600 md:text-[15px]">
              Hand-picked menswear in honest fabrics. Made for daily wear, priced
              without the typical retail markup. Shipped from Delhi NCR.
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
        </div>

        {/* RIGHT COLUMN — tilted collage.
            Cards absolute-positioned inside the column; column height comes
            entirely from `min-h`. See math note in the previous iteration —
            if you change the card width/aspect, bump min-h to match so the
            cards don't visually spill below their box. */}
        <div className="relative min-h-[320px] md:min-h-[480px]">
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
      </div>
    </section>
  );
}
