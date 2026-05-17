import { StaticPage } from '@/components/static-page';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

export const metadata = { title: 'Visit the store' };

export default function VisitPage() {
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hi! I want to book a fitting at the store.')}`;
  return (
    <StaticPage
      title="Visit the store"
      intro="Our Bengaluru store stocks the full collection plus made-to-measure pieces that aren't available online. Walk in or book a fitting."
    >
      <h2>Address</h2>
      <p>
        Reloaded Bengaluru
        <br />
        24/B, MG Road, Indiranagar
        <br />
        Bengaluru 560008
      </p>
      <h2>Hours</h2>
      <p>Tuesday – Sunday, 11am – 9pm IST. Closed Mondays.</p>
      <h2>Book a fitting</h2>
      <p>
        Walk-ins are welcome, but if you want one of our team to set time aside for a fitting
        or made-to-measure consultation, WhatsApp us.
      </p>
      <div className="not-prose mt-2">
        <Button asChild variant="whatsapp" size="lg">
          <a href={whatsappHref} target="_blank" rel="noopener">
            <MessageCircle className="mr-2 h-4 w-4" />
            Book a fitting
          </a>
        </Button>
      </div>
    </StaticPage>
  );
}
