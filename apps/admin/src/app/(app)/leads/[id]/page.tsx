import { notFound } from 'next/navigation';
import type { LeadSummary } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { LeadDetail } from './lead-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await api<LeadSummary>(`/admin-leads/${id}`);
  if (!res.ok || !res.body) notFound();
  const lead = res.body;

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Growth' },
          { label: 'Leads', href: '/leads' },
          { label: lead.name ?? lead.phone ?? lead.email ?? '—' },
        ]}
        title={lead.name ?? lead.phone ?? lead.email ?? 'Lead'}
        description={`Source: ${lead.source.replace(/_/g, ' ')} · Created ${new Date(lead.createdAt).toLocaleDateString('en-IN')}`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <LeadDetail initial={lead} />
      </div>
    </div>
  );
}
