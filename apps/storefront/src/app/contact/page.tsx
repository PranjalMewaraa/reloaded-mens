import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaticPage } from '@/components/static-page';
import { env } from '@/lib/env';
import { ContactForm } from './contact-form';

export const metadata = { title: 'Contact & WhatsApp' };

export default function ContactPage() {
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}`;
  return (
    <StaticPage
      title="Contact & WhatsApp"
      intro="The fastest way to reach us is on WhatsApp. Real humans, weekdays 10am–8pm IST."
    >
      <div className="not-prose mt-2 flex flex-wrap items-center gap-3">
        <Button asChild variant="whatsapp" size="lg">
          <a href={whatsappHref} target="_blank" rel="noopener">
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat on WhatsApp
          </a>
        </Button>
        <a
          href={`tel:${env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2.5 text-[13px] text-ink-900 hover:border-ink-900"
        >
          <Phone className="h-4 w-4" />
          {env.NEXT_PUBLIC_WHATSAPP_NUMBER}
        </a>
      </div>

      <h2>Send us a message</h2>
      <div className="not-prose">
        <ContactForm whatsappHref={whatsappHref} />
      </div>

      <h2>Email</h2>
      <p>
        For longer queries or wholesale interest, email{' '}
        <a href="mailto:hello@example.com">hello@example.com</a>. We typically reply within
        one business day.
      </p>
      <h2>Visit us</h2>
      <p>
        Try things on in person at our Bengaluru store. See the <a href="/visit">visit page</a>{' '}
        for directions and trading hours.
      </p>
    </StaticPage>
  );
}
