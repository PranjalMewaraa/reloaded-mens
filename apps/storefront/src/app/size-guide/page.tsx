import { StaticPage } from '@/components/static-page';

export const metadata = { title: 'Size guide' };

export default function SizeGuidePage() {
  return (
    <StaticPage
      title="Size guide"
      intro="Our pieces are cut for an everyday Indian fit — slightly fuller on the chest and shoulder than your average international brand."
    >
      <h2>How to measure</h2>
      <p>
        Use a soft tape and measure over your favourite t-shirt. Chest: across the fullest
        point. Waist: at the natural waist, not on your hips. Length: from the highest point
        of the shoulder down to where you want the hem to sit.
      </p>
      <h2>Shirts</h2>
      <p>
        Size in cm. Add 2cm of breathing room if you&apos;re between sizes — our shirts are
        on the trimmer side of regular.
      </p>
      <h2>Trousers</h2>
      <p>
        Our trousers are tagged by waist. The inseam is 30&quot; on regulars and 32&quot; on
        talls. Hemming is included in-store — bring a pair of shoes you&apos;ll wear with
        them.
      </p>
      <h2>Still not sure?</h2>
      <p>
        WhatsApp us your measurements and we&apos;ll recommend a size. Real humans, fast
        replies.
      </p>
    </StaticPage>
  );
}
