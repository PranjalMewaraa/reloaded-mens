import Link from 'next/link';
import type { AdminReturnListItem } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ReturnsList } from './returns-list';

export const metadata = { title: 'Returns queue' };

interface ListResponse {
  items: AdminReturnListItem[];
  page: number;
  limit: number;
  total: number;
}

interface PageProps {
  searchParams?: Promise<{ state?: string; page?: string }>;
}

export default async function ReturnsQueuePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  query.set('state', sp.state ?? 'requested');
  if (sp.page) query.set('page', sp.page);
  const res = await api<ListResponse>(`/admin-returns?${query.toString()}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Orders', href: '/orders' },
          { label: 'Returns' },
        ]}
        title="Returns queue"
        description={`${data.total} request${data.total === 1 ? '' : 's'} in this view.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/orders">Back to orders</Link>
          </Button>
        }
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <ReturnsList initial={data.items} currentState={sp.state ?? 'requested'} />
      </div>
    </div>
  );
}
