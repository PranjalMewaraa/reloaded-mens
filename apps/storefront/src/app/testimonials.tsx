import { Quote, Star } from 'lucide-react';

// Hand-picked testimonials. Keep these short (≤ 22 words) so the cards line
// up cleanly in the 3-up grid. Edit in-place to swap; if you ever want this
// CMS-driven we can move it to the Settings table.
const TESTIMONIALS: Array<{
  body: string;
  name: string;
  meta: string;
  rating: number;
}> = [
  {
    body:
      "Honestly the fit on these trousers is unreal. Felt the difference the moment I tried them on.",
    name: 'Aarav S.',
    meta: 'Delhi · returning customer',
    rating: 5,
  },
  {
    body:
      "I wanted one shirt and ended up with three. The fabric quality at this price point is silly.",
    name: 'Rohan K.',
    meta: 'Bombay · first order',
    rating: 5,
  },
  {
    body:
      "WhatsApp support sent me three sizing options. Took me five minutes — wish more brands did this.",
    name: 'Ishaan V.',
    meta: 'Bengaluru · repeat',
    rating: 5,
  },
];

// Testimonials slot. Sits just above the trust strip on the homepage so the
// rhythm is product → social proof → brand promises → footer. Pure server
// component — no interactivity, no carousel. If the list grows past 4 we
// can swap in a horizontal scroll or an embla carousel.
export function Testimonials() {
  return (
    <section className="px-5 pb-12 md:px-8 md:pb-16">
      <div className="mb-6 flex items-end justify-between md:mb-8">
        <div>
          <span className="label-caps">Word of mouth</span>
          <h2 className="mt-1 font-display text-[24px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
            What customers say
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {TESTIMONIALS.map((t, i) => (
          <figure
            key={i}
            className="relative flex flex-col rounded-2xl border border-ink-100 bg-snow p-5 md:p-6"
          >
            {/* Decorative quote glyph in the corner — pure ornament, hidden
                from assistive tech. */}
            <Quote
              aria-hidden
              className="absolute right-5 top-5 h-5 w-5 text-ink-200"
              strokeWidth={1.5}
            />

            <div className="flex items-center gap-1 text-ink-900" aria-label={`${t.rating} out of 5 stars`}>
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star key={j} className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
              ))}
            </div>

            <blockquote className="mt-3 text-[14.5px] leading-[1.55] text-ink-800">
              &ldquo;{t.body}&rdquo;
            </blockquote>

            <figcaption className="mt-4 flex flex-col text-[12.5px]">
              <span className="font-medium text-ink-900">{t.name}</span>
              <span className="text-ink-500">{t.meta}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
