import { notFound } from 'next/navigation';
import type { AdminOrderDetail } from '@repo/types';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { PageHeader } from '@/components/shell/page-header';
import { OrderDetail } from './order-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Order detail' };

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [res, user] = await Promise.all([
    api<AdminOrderDetail>(`/orders/${encodeURIComponent(id)}`),
    getCurrentUser(),
  ]);
  if (!res.ok || !res.body) notFound();
  const order = res.body;

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Orders', href: '/orders' },
          { label: order.orderNumber },
        ]}
        title={order.orderNumber}
        description={`Placed ${new Date(order.placedAt).toLocaleString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <OrderDetail order={order} role={user?.role ?? 'staff'} />
      </div>
    </div>
  );
}
