'use client';

import * as React from 'react';

interface MarqueeProps {
  items: React.ReactNode[];
  // Seconds per full loop. Higher = slower. The visual speed (px/s) depends on
  // viewport width, so you'll want different durations for top-bar (~28s) vs
  // section-break (~40s) marquees.
  speed?: number;
  className?: string;
  // Inline separator between items. Defaults to a thin "//" in muted color.
  separator?: React.ReactNode;
  // Pause the animation on hover. On by default; some announcement bars want
  // to keep running regardless.
  pauseOnHover?: boolean;
  // Whether to expose the items to assistive tech. For decorative editorial
  // marquees, keep this false. For real announcement copy ("free shipping
  // above ₹1499"), set true so screen readers pick it up.
  announce?: boolean;
}

// Animated horizontal marquee. Renders the item strip twice and slides the
// outer track left by exactly 50% on each loop, so the seam where strip-2
// continues from strip-1 is visually identical.
//
// Pure CSS keyframe (defined in tailwind.config.ts as `marquee`) — no JS in
// the hot path, no re-renders per frame, no requestAnimationFrame to leak.
export function Marquee({
  items,
  speed = 40,
  className = '',
  separator,
  pauseOnHover = true,
  announce = false,
}: MarqueeProps) {
  const sep =
    separator ?? (
      <span aria-hidden className="px-4 opacity-50 select-none">
        //
      </span>
    );

  const Strip = ({ ariaHidden }: { ariaHidden: boolean }) => (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span className="whitespace-nowrap">{item}</span>
          {sep}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className={`group relative overflow-hidden ${className}`}>
      <div
        className={`flex w-max ${pauseOnHover ? 'group-hover:[animation-play-state:paused]' : ''}`}
        style={{ animation: `marquee ${speed}s linear infinite` }}
      >
        {/* First strip — exposed to AT if `announce` is true, otherwise hidden. */}
        <Strip ariaHidden={!announce} />
        {/* Second strip — always aria-hidden so AT doesn't repeat the items. */}
        <Strip ariaHidden />
      </div>
    </div>
  );
}
