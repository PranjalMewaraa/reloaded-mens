import Link from 'next/link';
import { Instagram, MessageCircle, Phone } from 'lucide-react';
import { env } from '@/lib/env';

// Canonical Instagram profile — the `?igsh=` tracking param Instagram adds
// when you tap "Share this profile" is stripped so we don't ship referral
// goo to every visitor's click.
const INSTAGRAM_URL = 'https://www.instagram.com/reloadedmensss';
const INSTAGRAM_HANDLE = '@reloadedmensss';

// Business contact numbers. Both live in deploy/.env.production.example as
// BUSINESS_PHONE_PRIMARY / BUSINESS_PHONE_SECONDARY, but those are server-
// side env vars — exposing them to the storefront would require new
// NEXT_PUBLIC_* envs + a rebuild pipeline plumbing for two strings that
// effectively never change. Hardcoded here is the simpler trade.
//
// `tel:` href uses the E.164 form (no spaces) so iOS/Android dial correctly;
// the visible label uses spaces for readability.
const PHONES: Array<{ tel: string; label: string }> = [
  { tel: '+919958247377', label: '+91 99582 47377' },
  { tel: '+918285317062', label: '+91 82853 17062' },
];

const SHOP_LINKS = [
  { href: '/c/shirts', label: 'Shirts' },
  { href: '/c/trousers', label: 'Trousers' },
  { href: '/c/knitwear', label: 'Knitwear' },
  { href: '/c/sale', label: 'Sale' },
];

const HELP_LINKS = [
  { href: '/size-guide', label: 'Size guide' },
  { href: '/shipping', label: 'Shipping' },
  { href: '/returns', label: 'Returns & exchanges' },
  { href: '/contact', label: 'Contact & WhatsApp' },
];

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export function Footer() {
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}`;
  return (
    <footer className="mt-16 border-t border-ink-100 bg-bone">
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="font-display text-[28px] font-semibold tracking-tight text-ink-900">
              {env.NEXT_PUBLIC_BRAND_NAME}.
            </div>
            <p className="mt-2 max-w-[36ch] text-[13px] leading-[1.6] text-ink-600">
              Menswear made for everyday wear. Hand-picked, honest pricing, shipped from
              Delhi NCR.
            </p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-whatsapp px-4 py-3 text-snow shadow-soft hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-[13px] font-medium">Talk to a stylist on WhatsApp</span>
            </a>
            <p className="mt-2 text-[11.5px] text-ink-500">10am–8pm IST</p>

            {/* Social — Instagram for now; add new platforms inline. The icon
                + handle row is small enough to fade behind the WhatsApp CTA
                while still being scannable. */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-ink-700 hover:text-ink-900"
              aria-label={`Follow us on Instagram, ${INSTAGRAM_HANDLE}`}
            >
              <Instagram className="h-4 w-4" />
              <span>{INSTAGRAM_HANDLE}</span>
            </a>

            {/* Phone numbers — both surfaced so a customer who prefers calls
                over WhatsApp has a path. Single Phone icon + stacked numbers
                so it reads as one "Call us" group rather than two separate
                links competing for attention. `tel:` hrefs use E.164. */}
            <div className="mt-3 flex items-start gap-2 text-[12.5px] text-ink-700">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <div className="flex flex-col gap-0.5">
                {PHONES.map((p) => (
                  <a key={p.tel} href={`tel:${p.tel}`} className="hover:text-ink-900">
                    {p.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <FooterColumn label="Shop" links={SHOP_LINKS} />
          <FooterColumn label="Help" links={HELP_LINKS} />
          <FooterColumn label="The fine print" links={LEGAL_LINKS} />
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-ink-100 pt-6 text-[11.5px] text-ink-500 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {env.NEXT_PUBLIC_BRAND_NAME}. All rights reserved.</span>
          <span className="font-mono uppercase tracking-caps">Curated in India</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  label,
  links,
}: {
  label: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <div className="label-caps mb-3">{label}</div>
      <ul className="flex flex-col gap-2 text-[13px] text-ink-700">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-ink-900">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
