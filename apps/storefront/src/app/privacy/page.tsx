import { StaticPage } from '@/components/static-page';

export const metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy policy"
      intro="We collect only what we need to fulfil your order and offer support. No third-party data sales — ever."
    >
      <h2>What we collect</h2>
      <p>
        Order data (name, phone, address), payment confirmations (no card numbers — those
        stay with the payment processor), and basic browsing analytics to understand which
        pieces resonate. WhatsApp opt-ins are explicit and revocable from your account.
      </p>
      <h2>How we use it</h2>
      <p>
        To process orders, send shipping updates, and improve the catalogue. We&apos;ll
        WhatsApp or email you about your order, and only ever marketing-message you if
        you&apos;ve opted in.
      </p>
      <h2>Your rights</h2>
      <p>
        You can request a copy of your data or ask us to delete your account by emailing the
        address on the contact page. We&apos;ll respond within seven business days.
      </p>
    </StaticPage>
  );
}
