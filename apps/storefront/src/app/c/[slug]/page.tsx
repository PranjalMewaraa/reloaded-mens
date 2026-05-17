import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/product/product-card';
import { EmptyState } from '@/components/product/empty-state';
import { CategoryFilterBar } from './filter-bar';
import { publicApi } from '@/lib/api';

interface PublicListResponse {
  items: ProductCardData[];
  page: number;
  limit: number;
  total: number;
  sort: string;
}

interface CategoryResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    sort?: string;
    page?: string;
    size?: string;
    color?: string;
    minPricePaisa?: string;
    maxPricePaisa?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const res = await publicApi<CategoryResponse>(`/public/categories/${slug}`);
  if (!res.ok || !res.body) return { title: 'Category' };
  return {
    title: res.body.seoTitle ?? res.body.name,
    description: res.body.seoDescription ?? res.body.description ?? undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  const query = new URLSearchParams();
  query.set('category', slug);
  if (sp.sort) query.set('sort', sp.sort);
  if (sp.page) query.set('page', sp.page);
  if (sp.size) query.set('size', sp.size);
  if (sp.color) query.set('color', sp.color);
  if (sp.minPricePaisa) query.set('minPricePaisa', sp.minPricePaisa);
  if (sp.maxPricePaisa) query.set('maxPricePaisa', sp.maxPricePaisa);

  const [categoryRes, productsRes] = await Promise.all([
    publicApi<CategoryResponse>(`/public/categories/${slug}`),
    publicApi<PublicListResponse>(`/public/products?${query.toString()}`),
  ]);

  if (!categoryRes.ok || !categoryRes.body) {
    notFound();
  }

  const category = categoryRes.body;
  const products = productsRes.ok && productsRes.body ? productsRes.body.items : [];
  const total = productsRes.ok && productsRes.body ? productsRes.body.total : 0;

  // Collect unique sizes and colors for the filter bar. We derive these from the current
  // result set so the filter only ever offers options that actually exist. Until search
  // facets exist on the API side, this is "good enough".
  const sizes = Array.from(new Set(products.flatMap((p) => productSizes(p)))).sort();
  const colors = Array.from(new Set(products.flatMap((p) => p.colors))).sort();

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <nav className="label-caps flex items-center gap-1.5 px-5 pt-5 md:px-8 md:pt-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink-900">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-ink-300" aria-hidden />
        <span className="text-ink-900">{category.name}</span>
      </nav>

      <header className="px-5 py-4 md:px-8 md:py-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[36px]">
          {category.name}
        </h1>
        <p className="mt-1 text-[12.5px] text-ink-500">
          {total} {total === 1 ? 'piece' : 'pieces'} in stock
        </p>
        {category.description ? (
          <p className="mt-2 max-w-[65ch] text-[13px] leading-[1.55] text-ink-600">
            {category.description}
          </p>
        ) : null}
      </header>

      <CategoryFilterBar
        slug={slug}
        sizes={sizes}
        colors={colors}
        active={{
          sort: sp.sort ?? 'featured',
          size: sp.size,
          color: sp.color,
        }}
      />

      <div className="px-5 pb-12 md:px-8 md:pb-16">
        {products.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            description="Try removing a filter, or browse a different category."
            action={
              <Link href={`/c/${slug}`} className="text-[13px] text-ink-900 underline-offset-4 hover:underline">
                Clear filters
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// API doesn't return per-product sizes directly in the card payload (the card only needs
// colors). We sniff sizes off the variant-derived `colors` axis indirectly via a small
// helper that returns an empty array — sizes are filtered server-side, so this is just
// for surfacing chips. The category filter falls back to a hardcoded set if empty.
function productSizes(_p: ProductCardData): string[] {
  // The list endpoint doesn't surface sizes on cards (would bloat the payload). The
  // filter bar shows a fixed common set; the actual filter applies server-side.
  return [];
}
