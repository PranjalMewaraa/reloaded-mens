import Link from 'next/link';
import type { AdminOrderListItem } from '@repo/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/page-header';
import { OrdersList } from './orders-list';

export const metadata = { title: 'Orders' };

interface ListResponse {
  items: AdminOrderListItem[];
  page: number;
  limit: number;
  total: number;
}

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    state?: string;
    paymentState?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  if (sp.page) query.set('page', sp.page);
  if (sp.limit) query.set('limit', sp.limit);
  if (sp.q) query.set('q', sp.q);
  if (sp.state) query.set('state', sp.state);
  if (sp.paymentState) query.set('paymentState', sp.paymentState);
  const qs = query.toString();
  const res = await api<ListResponse>(`/orders${qs ? `?${qs}` : ''}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Orders' }]}
        title="Orders"
        description={`${data.total} order${data.total === 1 ? '' : 's'} in the system.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/orders/refunds">Refunds queue</Link>
          </Button>
        }
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <OrdersList
          initial={data.items}
          page={data.page}
          limit={data.limit}
          total={data.total}
          initialQuery={sp.q ?? ''}
          initialState={sp.state ?? ''}
          initialPaymentState={sp.paymentState ?? ''}
        />
      </div>
    </div>
  );
}
