import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono, Fraunces } from 'next/font/google';
import './globals.css';
import { StoreShell } from '@/components/shell/store-shell';
import { publicApi } from '@/lib/api';
import { getCustomerProfile } from '@/lib/customer-server';
import { env } from '@/lib/env';

interface CategoryTreeNode {
  id: string;
  slug: string;
  name: string;
}

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700'],
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500'],
});
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: {
    default: `${env.NEXT_PUBLIC_BRAND_NAME} · Menswear, made for everyday wear`,
    template: `%s · ${env.NEXT_PUBLIC_BRAND_NAME}`,
  },
  description:
    'Considered menswear from Bengaluru. Shirts, trousers, and knitwear in honest fabrics with honest pricing.',
  metadataBase: new URL(env.NEXT_PUBLIC_STOREFRONT_URL),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch the category tree once at the root layout so every page renders the same nav
  // without re-fetching. We flatten root-level categories for the desktop nav strip and
  // the mobile drawer. Sprint 8 — also read the customer profile from the cookie so the
  // header can render the right CTA on first paint (no client-flash from "Sign in" to
  // "Account").
  const [res, customer] = await Promise.all([
    publicApi<{ items: CategoryTreeNode[] }>('/public/categories'),
    getCustomerProfile(),
  ]);
  const navCategories =
    res.ok && res.body
      ? res.body.items.map((n) => ({ slug: n.slug, name: n.name }))
      : [];

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jetbrains.variable} ${fraunces.variable}`}
    >
      <body className="font-sans">
        <StoreShell navCategories={navCategories} initialCustomer={customer}>
          {children}
        </StoreShell>
      </body>
    </html>
  );
}
