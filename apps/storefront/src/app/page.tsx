import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard, type ProductCardData } from '@/components/product/product-card';
import { publicApi } from '@/lib/api';
import { env } from '@/lib/env';

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
      {/* Hero */}
      <section className="grid gap-6 px-5 pb-12 pt-6 md:grid-cols-[5fr_7fr] md:gap-10 md:px-8 md:py-16">
        <div className="flex flex-col justify-center">
          <span className="label-caps">SS26 · The first drop</span>
          <h1 className="mt-3 font-display text-[44px] font-semibold leading-[1.04] tracking-tight text-ink-900 md:text-[72px]">
            Clothes for the men who wear them.
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.6] text-ink-600">
            Considered cuts in honest fabrics. Made for daily wear, priced without the
            middlemen. Shipped from Bengaluru.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href="/c/shirts">Shop the drop</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/visit">Visit the store</Link>
            </Button>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-ink-100 md:aspect-[5/6]">
          <div className="absolute inset-0 grid place-items-center font-mono text-[10.5px] uppercase tracking-caps text-ink-300">
            Hero photo
          </div>
        </div>
      </section>

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
            <h2 className="font-display text-[24px] font-semibold tracking-tight text-ink-900 md:text-[34px]">
              New in
            </h2>
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
            label="Made in India"
            body="Cut, sewn, and finished in small workshops across Bengaluru and Tirupur."
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
