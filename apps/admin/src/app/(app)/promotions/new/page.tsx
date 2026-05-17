import { PageHeader } from '@/components/shell/page-header';
import { PromotionEditor } from '../promotion-editor';

export const metadata = { title: 'New promotion' };

export default function NewPromotionPage() {
  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Growth' },
          { label: 'Promotions', href: '/promotions' },
          { label: 'New' },
        ]}
        title="New promotion"
        description="Configure conditions, actions, and (for coupon-gated promotions) redeemable codes."
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <PromotionEditor mode="create" />
      </div>
    </div>
  );
}
