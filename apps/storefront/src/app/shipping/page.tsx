import { StaticPage } from '@/components/static-page';

export const metadata = { title: 'Shipping' };

export default function ShippingPage() {
  return (
    <StaticPage
      title="Shipping"
      intro="We ship across most major cities and towns in India. Enter your pincode on any product page to see the exact delivery date and shipping fee."
    >
      <h2>Delivery times</h2>
      <p>
        Metros: 3–5 business days. Other serviceable pincodes: 5–7 business days. We dispatch
        from our Ghaziabad warehouse Monday to Saturday.
      </p>
      <h2>Shipping fees</h2>
      <p>
        Free shipping over ₹1,499. Below that, ₹99 flat. COD is available on serviceable
        pincodes with an additional ₹49 handling.
      </p>
      <h2>Not in our network yet?</h2>
      <p>
        We&apos;re adding ~200 pincodes a quarter. If we don&apos;t ship to your pincode yet,
        WhatsApp us — we can sometimes arrange a private courier for a small additional fee.
      </p>
    </StaticPage>
  );
}
