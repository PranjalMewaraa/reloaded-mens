import type { LeadListResponse } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { LeadsList } from './leads-list';

export const metadata = { title: 'Leads' };

interface PageProps {
  searchParams?: Promise<{ status?: string; source?: string; q?: string; page?: string }>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  if (sp.status) query.set('status', sp.status);
  if (sp.source) query.set('source', sp.source);
  if (sp.q) query.set('q', sp.q);
  if (sp.page) query.set('page', sp.page);
  const res = await api<LeadListResponse>(`/admin-leads?${query.toString()}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Growth' }, { label: 'Leads' }]}
        title="Leads"
        description={`${data.total} lead${data.total === 1 ? '' : 's'} in this view.`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <LeadsList
          initial={data.items}
          currentStatus={sp.status ?? 'all'}
          currentSource={sp.source ?? 'all'}
          currentQ={sp.q ?? ''}
        />
      </div>
    </div>
  );
}
