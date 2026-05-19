import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Brand wordmark hero — large bold "ReloadedMens" type extending past its
// column boundary into the image area. White text + mix-blend-mode: difference
// inverts the type based on what's behind it, so the wordmark stays readable
// where it overlaps both the white background and the dark image cards.
//
// Right-side image cards use CSS 3D transforms (perspective + rotateY/rotateX)
// to read as tilted floating panels, with a continuous float keyframe (defined
// in globals.css) gently bobbing each card on opposite vertical phases.
//
// Server component — all motion is pure CSS, no client JS needed. Respects
// prefers-reduced-motion via the keyframe being unused once that media query
// disables `animation` globally (it doesn't in this codebase by default, so
// the float still plays — add a wrapper rule in globals.css if you want to
// honor reduced-motion here too).

const HERO_IMAGE_1 = '/hero/hero-1.jpeg';
const HERO_IMAGE_2 = '/hero/hero-2.jpeg';

export function Hero() {
  return (
    // `isolate` creates a new stacking context so the mix-blend-mode on the
    // headline only blends against this hero's bg + images, not whatever the
    // page above happens to paint behind us. `overflow-hidden` clips the
    // wordmark when it's wider than the viewport at very small sizes.
    <section className="relative isolate overflow-hidden bg-snow">
      {/* IMAGE COLLAGE — desktop only.
          Two cards absolutely positioned on the right half of the section.
          Each card carries its own 3D transform + float animation (see
          @keyframes hero-float-{1,2} in globals.css). pointer-events:none so
          the cards never intercept clicks meant for the CTAs underneath. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden md:block"
        aria-hidden
      >
        <div className="relative h-full w-[58vw] max-w-[820px]">
          {/* Back card — tilts left, floats up. */}
          <div
            className="absolute right-[34%] top-[14%] aspect-[3/4] w-[40%] overflow-hidden rounded-md shadow-[0_35px_80px_-20px_rgba(0,0,0,0.4)] ring-1 ring-black/5"
            style={{ animation: 'hero-float-1 7s ease-in-out infinite' }}
          >
            <Image
              src={HERO_IMAGE_1}
              alt=""
              fill
              priority
              sizes="35vw"
              className="object-cover"
            />
          </div>
          {/* Front card — tilts right, floats down (opposite phase). */}
          <div
            className="absolute right-[2%] top-[34%] aspect-[3/4] w-[46%] overflow-hidden rounded-md shadow-[0_35px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
            style={{ animation: 'hero-float-2 8s ease-in-out infinite 0.6s' }}
          >
            <Image
              src={HERO_IMAGE_2}
              alt=""
              fill
              priority
              sizes="35vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-5 pb-12 pt-8 md:px-8 md:pb-20 md:pt-16">
        <span className="label-caps">SS26 · The first drop</span>

        {/* WORDMARK — white type + mix-blend-mode: difference produces the
            "color-shifting over images" effect from the spec. On the white
            bg it appears as black; over the darker image cards it appears
            as white (or whatever inverted color of the image's pixel).
            font-size scales fluidly with viewport so the wordmark fills the
            row without overflow at common widths. */}
        <h1
          className="relative z-10 mt-3 select-none font-sans font-extrabold leading-[0.86] tracking-[-0.04em] text-snow"
          style={{
            mixBlendMode: 'difference',
            fontSize: 'clamp(54px, 13vw, 184px)',
            whiteSpace: 'nowrap',
          }}
        >
          ReloadedMens
        </h1>

        {/* MOBILE-ONLY hero image — mix-blend-mode without enough image area
            on small screens reads weird, so on mobile we stack the photo
            below the wordmark instead. */}
        <div className="relative mt-6 aspect-[4/5] overflow-hidden rounded-md md:hidden">
          <Image
            src={HERO_IMAGE_2}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {/* Subtitle + CTAs.
            Constrained max-w so the paragraph doesn't reach into the image
            area on desktop. Above the headline visually-wise it's the small
            label-caps tag; below the headline it's this column. */}
        <div className="relative mt-6 max-w-[44ch] md:mt-10">
          <p className="text-[14px] leading-[1.55] text-ink-600 md:text-[15px]">
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
    </section>
  );
}
