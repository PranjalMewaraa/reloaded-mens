import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { InventoryList, type InventoryListItem } from './inventory-list';

export const metadata = { title: 'Inventory' };

interface InventoryResponse {
  items: InventoryListItem[];
  page: number;
  limit: number;
  total: number;
}

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    lowStockOnly?: string;
  }>;
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  if (sp.page) query.set('page', sp.page);
  if (sp.limit) query.set('limit', sp.limit);
  if (sp.q) query.set('q', sp.q);
  if (sp.lowStockOnly) query.set('lowStockOnly', sp.lowStockOnly);
  const qs = query.toString();
  const res = await api<InventoryResponse>(`/variants${qs ? `?${qs}` : ''}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Inventory' }]}
        title="Inventory"
        description={`${data.total} variant${data.total === 1 ? '' : 's'} across the catalogue.`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <InventoryList
          initial={data.items}
          page={data.page}
          limit={data.limit}
          total={data.total}
          initialQuery={sp.q ?? ''}
          initialLowStockOnly={sp.lowStockOnly === 'true'}
        />
      </div>
    </div>
  );
}
