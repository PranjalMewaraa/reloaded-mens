import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/product/product-card';
import { EmptyState } from '@/components/product/empty-state';
import { publicApi } from '@/lib/api';

interface PublicListResponse {
  items: ProductCardData[];
  total: number;
}

interface CategoryNode {
  id: string;
  slug: string;
  name: string;
}

interface PageProps {
  searchParams?: Promise<{ sort?: string; page?: string }>;
}

export const metadata = { title: 'Shop everything' };

export default async function ShopIndexPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  if (sp.sort) query.set('sort', sp.sort);
  if (sp.page) query.set('page', sp.page);

  const [productsRes, categoriesRes] = await Promise.all([
    publicApi<PublicListResponse>(`/public/products?${query.toString()}`),
    publicApi<{ items: CategoryNode[] }>('/public/categories'),
  ]);

  const products = productsRes.ok && productsRes.body ? productsRes.body.items : [];
  const categories = categoriesRes.ok && categoriesRes.body ? categoriesRes.body.items : [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-10">
      <nav className="label-caps flex items-center gap-1.5" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink-900">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-ink-300" aria-hidden />
        <span className="text-ink-900">Shop</span>
      </nav>
      <h1 className="mt-3 font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[36px]">
        Shop everything
      </h1>
      <p className="mt-1 text-[13px] text-ink-500">
        {productsRes.ok && productsRes.body ? productsRes.body.total : 0} pieces in stock.
      </p>

      {categories.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="rounded-full border border-ink-200 bg-snow px-3 py-1.5 text-[12.5px] text-ink-700 hover:border-ink-900 hover:text-ink-900"
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing here yet"
            description="The shop is loading the latest pieces. Check back soon."
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
