import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/product/product-card';
import { Marquee } from '@/components/marquee';
import { publicApi } from '@/lib/api';
import { env } from '@/lib/env';
import { Hero } from './hero';

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
    <div className="mx-auto w-full max-w-[1400px]">
      <Hero />

      {/* Featured categories */}
      {categories.length > 0 ? (
        <section className="px-5 pb-12 md:px-8 md:pb-16">
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

      {/* Editorial marquee — brand signature between sections. Slow scroll,
          full-bleed top and bottom hairline. Decorative only — no announce,
          so screen readers skip it (the phrases also appear in the trust strip
          + footer copy where AT can read them statically). */}
      <Marquee
        items={BRAND_PHRASES.map((p) => (
          <span className="font-display italic">{p}</span>
        ))}
        speed={48}
        className="my-6 border-y border-ink-100 py-4 text-[18px] text-ink-700 md:my-10 md:py-5 md:text-[22px]"
      />

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

      {/* Trust strip */}
      <section className="bg-ink-900 text-snow">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-5 py-10 md:grid-cols-3 md:px-8 md:py-12">
          <TrustItem
            label="Hand-picked"
            body="We comb menswear for the latest worth owning. Only the pieces that pass our own fit, fabric, and finish test make the shop."
          />
          <TrustItem
            label="14-day returns"
            body="Try it on at home. If it doesn't fit, send it back at no extra cost."
          />
          <TrustItem
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
    </div>
  );
}

function TrustItem({ label, body }: { label: string; body: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-caps text-snow/60">{label}</div>
      <p className="mt-2 text-[14px] leading-[1.55] text-snow/90">{body}</p>
    </div>
  );
}
