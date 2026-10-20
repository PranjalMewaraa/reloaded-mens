import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Sparkles, RotateCcw, MessageCircle } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/product/product-card';
import { Marquee } from '@/components/marquee';
import { publicApi } from '@/lib/api';
import { env } from '@/lib/env';
import { Hero } from './hero';
// Preserved legacy hero (tilted cards + blend mode) available for quick swap:
// import { HeroLegacy } from './hero-legacy';
import { Testimonials } from './testimonials';

// Editorial marquee — purely decorative, sits between sections like a brand
// signature. Slow-moving so it reads as a calm rhythm rather than motion.
// Phrasing aligns with Reloaded's actual positioning: we curate and resell
// the latest menswear, we don't manufacture — so no "made in India",
// "slow fashion", or "curated fabrics" (which all imply craftsmanship).
const BRAND_PHRASES = [
  'Hand-picked',
  'Latest drops',
  'Best in menswear',
  'Honest pricing',
  'Drop 01',
];

interface PublicListResponse {
  items: ProductCardData[];
}

interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}

export default async function HomePage() {
  // Pull featured products (newest 8) + the category tree in parallel.
  const [featuredRes, categoriesRes] = await Promise.all([
    publicApi<PublicListResponse>('/public/products?sort=new&limit=8'),
    publicApi<{ items: CategoryNode[] }>('/public/categories'),
  ]);
  const featured = featuredRes.ok && featuredRes.body ? featuredRes.body.items : [];
  const categories =
    categoriesRes.ok && categoriesRes.body ? categoriesRes.body.items.slice(0, 4) : [];

  return (
    <div className="w-full">
      <Hero />

      {/* Full-width editorial marquee — black background with crisp white typography */}
      <Marquee
        items={BRAND_PHRASES.map((p) => (
          <span key={p} className="font-display italic tracking-wide">
            {p}
          </span>
        ))}
        speed={42}
        className="w-full border-y border-neutral-800 bg-[#0a0a0a] py-3.5 text-[16px] text-white md:py-4.5 md:text-[20px]"
      />

      <div className="mx-auto w-full max-w-[1400px]">
        {/* Featured categories */}
        {categories.length > 0 ? (
          <section className="px-5 py-10 md:px-8 md:pb-16 md:pt-12">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-[24px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
                Shop by category
              </h2>
              <Link
                href="/shop"
                className="hidden items-center gap-1 text-[13px] text-ink-700 hover:text-ink-900 md:inline-flex"
              >
                Browse all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/c/${c.slug}`}
                  className="group relative aspect-square overflow-hidden rounded-md bg-ink-100"
                >
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt={c.name}
                      fill
                      // 2 cols on mobile (≈50vw), 4 cols on md+ (≈25vw). Lets
                      // Next pick a sensibly-sized candidate from the optimizer.
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : null}
                  {/* Bottom-anchored gradient so the white name pill stays
                      readable over bright or busy photos. Sits between the
                      image and the pill in the stacking order. */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />
                  <div className="absolute inset-0 grid place-items-end p-3">
                    <span className="rounded-full bg-snow/85 px-2.5 py-1 text-[12px] font-medium text-ink-900 backdrop-blur-sm">
                      {c.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* New in rail */}
      {featured.length > 0 ? (
        <section className="px-5 pb-12 md:px-8 md:pb-16">
          <div className="mb-4 flex items-end justify-between">
            <div className="flex items-baseline gap-3">
              <span className="label-caps">Drop 01</span>
              <h2 className="font-display text-[24px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
                New in
              </h2>
            </div>
            <Link
              href="/shop?sort=new"
              className="text-[13px] text-ink-700 hover:text-ink-900"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      </div>

      {/* Trust strip — full bleed black background placed above customer feedback */}
      <section className="w-full bg-ink-900 text-snow">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-5 py-10 md:grid-cols-3 md:px-8 md:py-12">
          <TrustItem
            icon={Sparkles}
            label="Hand-picked"
            body="We comb menswear for the latest worth owning. Only the pieces that pass our own fit, fabric, and finish test make the shop."
          />
          <TrustItem
            icon={RotateCcw}
            label="14-day returns"
            body="Try it on at home. If it doesn't fit, send it back at no extra cost."
          />
          <TrustItem
            icon={MessageCircle}
            label="WhatsApp support"
            body={
              <>
                Real humans, fast replies. Try us on WhatsApp at{' '}
                <a
                  href={`https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener"
                  className="underline-offset-4 hover:underline"
                >
                  {env.NEXT_PUBLIC_WHATSAPP_NUMBER}
                </a>
                .
              </>
            }
          />
        </div>
      </section>

      {/* Customer feedback / Social proof */}
      <div className="mx-auto w-full max-w-[1400px] pt-12 md:pt-16">
        <Testimonials />
      </div>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  label,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-snow ring-1 ring-white/10">
        <Icon className="h-5 w-5 text-snow/90" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-caps text-snow/70">
          {label}
        </div>
        <p className="mt-1 text-[13.5px] leading-[1.5] text-snow/90">{body}</p>
      </div>
    </div>
  );
}
