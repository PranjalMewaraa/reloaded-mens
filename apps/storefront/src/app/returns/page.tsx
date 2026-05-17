import { StaticPage } from '@/components/static-page';

export const metadata = { title: 'Returns & exchanges' };

export default function ReturnsPage() {
  return (
    <StaticPage
      title="Returns & exchanges"
      intro="14 days to change your mind. We pick up the return at no cost on serviceable pincodes."
    >
      <h2>How it works</h2>
      <p>
        Initiate a return from your order page within 14 days of delivery. Choose a refund or
        a replacement size. We&apos;ll schedule a pickup, inspect the item at the warehouse,
        and refund to your original payment method or send the replacement.
      </p>
      <h2>Conditions</h2>
      <p>
        Items should be unworn, unwashed, and have all original tags attached. Sale and
        in-store-only purchases are non-refundable, but exchanges for a different size are
        available within 7 days.
      </p>
      <h2>Refund timing</h2>
      <p>
        Once we receive and verify the return, refunds reflect on your account within 5–7
        business days. UPI is fastest; cards may take a full billing cycle.
      </p>
    </StaticPage>
  );
}
