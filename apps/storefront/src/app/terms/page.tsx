import { StaticPage } from '@/components/static-page';

export const metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <StaticPage
      title="Terms of service"
      intro="By using this site, you agree to the following terms. Last updated when we launch — we'll publish a versioned changelog as the legal entity evolves."
    >
      <h2>Use of this site</h2>
      <p>
        You may browse the catalogue and place orders for personal, non-commercial use.
        Bulk-buying for resale is not supported on the storefront — message us on WhatsApp if
        you&apos;re looking for trade pricing.
      </p>
      <h2>Pricing & taxes</h2>
      <p>
        All prices are in Indian Rupees and inclusive of GST. We reserve the right to correct
        pricing errors before order confirmation.
      </p>
      <h2>Cancellations & returns</h2>
      <p>
        Orders can be cancelled until they&apos;re packed. After dispatch, the standard
        returns policy applies — see our <a href="/returns">returns page</a>.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        We&apos;re responsible for fulfilling orders. We&apos;re not liable for delivery
        delays caused by carrier disruptions, weather, or events outside our reasonable
        control.
      </p>
    </StaticPage>
  );
}
