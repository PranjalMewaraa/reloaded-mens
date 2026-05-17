import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { RefundsList, type RefundListItem } from './refunds-list';

export const metadata = { title: 'Refunds queue' };

interface ListResponse {
  items: RefundListItem[];
  page: number;
  limit: number;
  total: number;
}

interface PageProps {
  searchParams?: Promise<{ status?: string; page?: string }>;
}

export default async function RefundsQueuePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  // Default to the pending queue — that's the queue this page is for.
  query.set('status', sp.status ?? 'pending_admin_approval');
  if (sp.page) query.set('page', sp.page);
  const res = await api<ListResponse>(`/refunds?${query.toString()}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Orders', href: '/orders' },
          { label: 'Refunds' },
        ]}
        title="Refunds queue"
        description={`${data.total} refund request${data.total === 1 ? '' : 's'} in this view.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/orders">Back to orders</Link>
          </Button>
        }
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <RefundsList initial={data.items} currentStatus={sp.status ?? 'pending_admin_approval'} />
      </div>
    </div>
  );
}
