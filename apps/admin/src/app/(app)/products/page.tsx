import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/page-header';
import { ProductsList, type ProductListItem } from './products-list';

export const metadata = { title: 'Products' };

interface ProductsListResponse {
  items: ProductListItem[];
  page: number;
  limit: number;
  total: number;
}

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    isActive?: string;
  }>;
}

// Server Component — reads filters out of the URL and forwards them to the API. All
// client-side filter changes route through router.replace() so the URL is the source of
// truth and the back button does the right thing.
export default async function ProductsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  if (sp.page) query.set('page', sp.page);
  if (sp.limit) query.set('limit', sp.limit);
  if (sp.q) query.set('q', sp.q);
  if (sp.isActive) query.set('isActive', sp.isActive);
  const qs = query.toString();
  const res = await api<ProductsListResponse>(`/products${qs ? `?${qs}` : ''}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Catalogue' }, { label: 'Products' }]}
        title="Products"
        description={`${data.total} product${data.total === 1 ? '' : 's'} in catalogue.`}
        actions={
          <Button asChild>
            <Link href="/products/new">
              <Plus className="mr-1.5 h-4 w-4" /> New product
            </Link>
          </Button>
        }
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <ProductsList
          initial={data.items}
          page={data.page}
          limit={data.limit}
          total={data.total}
          initialQuery={sp.q ?? ''}
          initialIsActive={sp.isActive ?? ''}
        />
      </div>
    </div>
  );
}
