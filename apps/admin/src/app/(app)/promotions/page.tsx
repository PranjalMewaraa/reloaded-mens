import Link from 'next/link';
import type { PromotionSummary } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { PromotionsList } from './promotions-list';

export const metadata = { title: 'Promotions' };

interface ListResponse {
  items: PromotionSummary[];
  page: number;
  limit: number;
  total: number;
}

interface PageProps {
  searchParams?: Promise<{ status?: string; type?: string; q?: string; page?: string }>;
}

export default async function PromotionsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  if (sp.status === 'active') query.set('isActive', 'true');
  if (sp.status === 'inactive') query.set('isActive', 'false');
  if (sp.type === 'automatic') query.set('isAutomatic', 'true');
  if (sp.type === 'coupon') query.set('isAutomatic', 'false');
  if (sp.q) query.set('q', sp.q);
  if (sp.page) query.set('page', sp.page);
  const res = await api<ListResponse>(`/admin-promotions?${query.toString()}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Growth' }, { label: 'Promotions' }]}
        title="Promotions"
        description={`${data.total} promotion${data.total === 1 ? '' : 's'} configured.`}
        actions={
          <Button asChild size="sm">
            <Link href="/promotions/new">+ New promotion</Link>
          </Button>
        }
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <PromotionsList
          initial={data.items}
          currentStatus={sp.status ?? 'all'}
          currentType={sp.type ?? 'all'}
          currentQ={sp.q ?? ''}
        />
      </div>
    </div>
  );
}
