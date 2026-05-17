import { notFound } from 'next/navigation';
import type { PromotionDetail } from '@repo/types';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { PromotionEditor } from '../promotion-editor';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const res = await api<PromotionDetail>(`/admin-promotions/${id}`);
  return { title: res.ok && res.body ? `${res.body.name} · Promotions` : 'Promotion' };
}

export default async function EditPromotionPage({ params }: PageProps) {
  const { id } = await params;
  const res = await api<PromotionDetail>(`/admin-promotions/${id}`);
  if (!res.ok || !res.body) {
    notFound();
  }
  const promo = res.body;
  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Growth' },
          { label: 'Promotions', href: '/promotions' },
          { label: promo.name },
        ]}
        title={promo.name}
        description={`Used ${promo.usageCount}×${promo.isAutomatic ? ' · automatic' : ` · ${promo.couponCount} coupon${promo.couponCount === 1 ? '' : 's'}`}.`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <PromotionEditor mode="edit" initial={promo} />
      </div>
    </div>
  );
}
