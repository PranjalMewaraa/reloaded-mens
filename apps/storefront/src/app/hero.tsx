'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Editorial High-Fashion Hero Section
// Inspired by luxury brand lookbooks with giant architectural typography,
// studio lighting backdrop, and layered model cutout stepping in front of the brand wordmark.

export function Hero() {
  const textRef = React.useRef<HTMLHeadingElement>(null);
  const modelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const handleScroll = () => {
      const y = window.scrollY;
      // Gentle depth parallax: the text glides slightly slower, model stays grounded
      if (textRef.current) {
        textRef.current.style.transform = `translateY(${y * 0.1}px)`;
      }
      if (modelRef.current) {
        modelRef.current.style.transform = `translateY(${y * 0.03}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section
      aria-label="New Season Hero"
      className="relative isolate w-full overflow-hidden select-none"
      style={{
        // Studio lighting: soft radial warmth in center with elegant dropoff to edges
        background:
          'radial-gradient(ellipse at 50% 48%, #f7f6f2 0%, #edebe6 55%, #dfded8 100%)',
      }}
    >
      <div className="relative mx-auto flex h-[82vh] min-h-[560px] max-h-[880px] w-full max-w-[1500px] flex-col justify-between p-6 sm:p-8 md:min-h-[640px] md:p-12 lg:min-h-[720px] lg:p-16">
        {/* ========================================================= */}
        {/* TOP ROW: Editorial Statement (Top-Left)                   */}
        {/* ========================================================= */}
        <div className="relative z-30 flex items-start justify-between">
          <div className="flex flex-col items-start">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.24em] text-[#121212] leading-[1.4] sm:text-[12px] md:text-[13px]">
              Fashion
              <br />
              That Moves
              <br />
              With You.
            </span>
            <span className="mt-2 h-[1.5px] w-7 bg-[#121212]" />
          </div>
        </div>

        {/* ========================================================= */}
        {/* MIDDLE LAYER: Giant Architectural Typography ("RELOADED MENS") */}
        {/* ========================================================= */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden px-2">
          <h1
            ref={textRef}
            className="w-full text-center font-sans font-black uppercase text-[#141414] whitespace-nowrap transition-transform duration-[40ms] will-change-transform"
            style={{
              fontSize: 'clamp(36px, 10.4vw, 168px)',
              letterSpacing: '-0.04em',
              lineHeight: 0.85,
            }}
          >
            Reloaded Mens
          </h1>
        </div>

        {/* ========================================================= */}
        {/* FOREGROUND LAYER: Walking Model Cutout + Contact Shadows   */}
        {/* ========================================================= */}
        <div
          ref={modelRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 top-[6%] z-20 mx-auto flex items-end justify-center transition-transform duration-[40ms] will-change-transform md:top-[3%]"
        >
          <div className="relative h-[92%] w-full max-w-[440px] sm:max-w-[520px] md:h-[96%] md:max-w-[620px] lg:max-w-[700px] xl:max-w-[760px]">
            {/* Ambient diffuse studio floor shadow */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[100%] bg-black/25 blur-xl"
              style={{
                width: 'min(78%, 460px)',
                height: '32px',
              }}
            />

            {/* Back foot contact shadow (left side) */}
            <div
              className="absolute bottom-[22px] left-[26%] rounded-[100%] bg-black/45 blur-[4px]"
              style={{
                width: '95px',
                height: '14px',
                transform: 'rotate(8deg)',
              }}
            />

            {/* Front foot contact shadow (right side) */}
            <div
              className="absolute bottom-[4px] right-[24%] rounded-[100%] bg-black/55 blur-[3px]"
              style={{
                width: '120px',
                height: '16px',
                transform: 'rotate(-4deg)',
              }}
            />

            {/* Transparent Model Cutout */}
            <Image
              src="/image.png"
              alt="Reloaded Menswear Editorial"
              fill
              priority
              sizes="(min-width: 1280px) 760px, (min-width: 1024px) 700px, (min-width: 768px) 620px, 92vw"
              className="object-contain object-bottom pointer-events-none select-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.12)]"
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* BOTTOM ROW: CTAs (Left) + Collection Year (Right)          */}
        {/* ========================================================= */}
        <div className="relative z-30 flex items-end justify-between gap-4">
          {/* Bottom-Left: Shop Now + Explore New In */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-7">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center bg-[#0e0e0e] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-sm transition-all duration-200 hover:bg-neutral-800 hover:shadow-md active:scale-95 sm:px-8 sm:py-3.5 md:text-[12px]"
            >
              Shop Now
            </Link>

            <Link
              href="/shop?sort=new"
              className="group inline-flex items-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#0e0e0e] transition-colors hover:text-neutral-600 sm:text-[12px]"
            >
              <span className="border-b-[1.5px] border-[#0e0e0e] pb-0.5 transition-all group-hover:border-neutral-500">
                Explore New In
              </span>
            </Link>
          </div>

          {/* Bottom-Right: New Collection 2026 */}
          <div className="hidden flex-col items-start sm:flex">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.24em] text-[#121212] leading-[1.4] md:text-[12px]">
              New
              <br />
              Collection
              <br />
              2026
            </span>
            <span className="mt-2 h-[1.5px] w-7 bg-[#121212]" />
          </div>
        </div>
      </div>
    </section>
  );
}
