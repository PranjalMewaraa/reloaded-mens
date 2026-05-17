import { notFound } from 'next/navigation';
import type { AdminReturnDetail } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { ReturnDetail } from './return-detail';

export const metadata = { title: 'Return detail' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReturnDetailPage({ params }: PageProps) {
  const { id } = await params;
  const res = await api<AdminReturnDetail>(`/admin-returns/${encodeURIComponent(id)}`);
  if (!res.ok || !res.body) notFound();
  const detail = res.body;

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Orders', href: '/orders' },
          { label: 'Returns', href: '/orders/returns' },
          { label: detail.returnNumber },
        ]}
        title={detail.returnNumber}
        description={`Filed ${new Date(detail.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <ReturnDetail detail={detail} />
      </div>
    </div>
  );
}
