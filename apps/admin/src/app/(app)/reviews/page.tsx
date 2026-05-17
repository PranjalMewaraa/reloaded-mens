import type { AdminReviewListResponse } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { ReviewsList } from './reviews-list';

export const metadata = { title: 'Reviews moderation' };

interface PageProps {
  searchParams?: Promise<{ status?: string; page?: string }>;
}

export default async function ReviewsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const status = sp.status ?? 'pending';
  const query = new URLSearchParams();
  if (status !== 'all') query.set('status', status);
  if (sp.page) query.set('page', sp.page);
  const res = await api<AdminReviewListResponse>(`/admin-reviews?${query.toString()}`);
  const data = res.ok && res.body ? res.body : { items: [], page: 1, limit: 20, total: 0 };

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Growth' }, { label: 'Reviews' }]}
        title="Reviews"
        description={`${data.total} review${data.total === 1 ? '' : 's'} in this tab.`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <ReviewsList initial={data.items} currentStatus={status} />
      </div>
    </div>
  );
}
