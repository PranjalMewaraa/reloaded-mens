import Link from 'next/link';
import { Search as SearchIcon } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/product/product-card';
import { EmptyState } from '@/components/product/empty-state';
import { SearchInput } from './search-input';
import { publicApi } from '@/lib/api';

interface PublicListResponse {
  items: ProductCardData[];
  total: number;
  page: number;
  limit: number;
}

interface PageProps {
  searchParams?: Promise<{ q?: string }>;
}

export const metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const q = sp.q?.trim() ?? '';

  let items: ProductCardData[] = [];
  let total = 0;
  if (q.length > 0) {
    const res = await publicApi<PublicListResponse>(
      `/public/products?q=${encodeURIComponent(q)}&limit=24`,
    );
    if (res.ok && res.body) {
      items = res.body.items;
      total = res.body.total;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-10">
      <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[36px]">
        Search
      </h1>
      <p className="mt-1 text-[13px] text-ink-500">
        Search by name, fabric, or keyword.
      </p>
      <div className="mt-5 max-w-xl">
        <SearchInput initialQuery={q} />
      </div>

      {q.length === 0 ? (
        <p className="mt-10 text-[13px] text-ink-500">Start typing to find pieces.</p>
      ) : items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={`No results for "${q}"`}
            description="Try a different keyword, or browse a category."
            action={
              <Link href="/" className="text-[13px] text-ink-900 underline-offset-4 hover:underline">
                Back to home
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-2 text-[13px] text-ink-500">
            <SearchIcon className="h-3.5 w-3.5" />
            <span>
              {total} result{total === 1 ? '' : 's'} for{' '}
              <span className="font-medium text-ink-900">&quot;{q}&quot;</span>
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
