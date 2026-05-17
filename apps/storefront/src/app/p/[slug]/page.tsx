import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/product/product-card';
import { Pill } from '@/components/ui/pill';
import { Pdp } from './pdp';
import { publicApi } from '@/lib/api';
import { formatINR } from '@/lib/utils';

interface ProductDetailResponse {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    basePricePaisa: number;
    compareAtPricePaisa: number | null;
    availabilityFlag: string;
    isReturnable: boolean;
    images: Array<{ url: string; alt: string; sortOrder: number }>;
    seoTitle: string | null;
    seoDescription: string | null;
    ogImageUrl: string | null;
    categories: Array<{ id: string; name: string; slug: string }>;
    variants: Array<{
      id: string;
      sku: string;
      size: string | null;
      color: string | null;
      stockCount: number;
      priceOverridePaisa: number | null;
    }>;
  };
  related: ProductCardData[];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const res = await publicApi<ProductDetailResponse>(`/public/products/${slug}`);
  if (!res.ok || !res.body) return { title: 'Product' };
  const p = res.body.product;
  return {
    title: p.seoTitle ?? p.name,
    description: p.seoDescription ?? p.description?.slice(0, 200) ?? undefined,
    openGraph: p.ogImageUrl ? { images: [p.ogImageUrl] } : undefined,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await publicApi<ProductDetailResponse>(`/public/products/${slug}`);
  if (!res.ok || !res.body) notFound();

  const { product, related } = res.body;

  // Crumbs derived from the product's first category (if any). MOOL design system shows
  // a single trail; we don't yet support multi-parent breadcrumbs.
  const breadcrumbCategory = product.categories[0];

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <nav
        className="label-caps flex items-center gap-1.5 px-5 pt-5 md:px-8 md:pt-8"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="hover:text-ink-900">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-ink-300" aria-hidden />
        {breadcrumbCategory ? (
          <>
            <Link href={`/c/${breadcrumbCategory.slug}`} className="hover:text-ink-900">
              {breadcrumbCategory.name}
            </Link>
            <ChevronRight className="h-3 w-3 text-ink-300" aria-hidden />
          </>
        ) : null}
        <span className="truncate text-ink-900">{product.name}</span>
      </nav>

      <Pdp product={product} />

      {related.length > 0 ? (
        <section className="px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
          <h2 className="font-display text-[24px] font-semibold tracking-tight text-ink-900 md:text-[30px]">
            You might also like
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {related.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* JSON-LD product schema for SEO. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            sku: product.variants[0]?.sku,
            offers: {
              '@type': 'Offer',
              priceCurrency: 'INR',
              price: (product.basePricePaisa / 100).toFixed(2),
              availability:
                product.availabilityFlag === 'in_store_only'
                  ? 'https://schema.org/InStoreOnly'
                  : 'https://schema.org/InStock',
            },
          }),
        }}
      />

      {/* Hidden SR helper — total of variants for screen readers. */}
      <span className="sr-only">
        {product.variants.length} variants, starting at {formatINR(product.basePricePaisa)}.
      </span>
      {product.availabilityFlag === 'in_store_only' ? (
        <span className="sr-only">
          <Pill tone="moss">In-store only</Pill>
        </span>
      ) : null}
    </div>
  );
}
