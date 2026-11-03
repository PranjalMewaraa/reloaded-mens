import type { Metadata } from 'next';
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

// Google Fonts loaded via <link> at runtime (not next/font/google) to avoid
// build-time network dependency that fails in CI environments.
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap';

export const metadata: Metadata = {
  title: {
    default: `${env.NEXT_PUBLIC_BRAND_NAME} · Menswear, made for everyday wear`,
    template: `%s · ${env.NEXT_PUBLIC_BRAND_NAME}`,
  },
  description:
    'Hand-picked menswear from Delhi NCR. Shirts, trousers, and knitwear in honest fabrics with honest pricing.',
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      </head>
      <body className="font-sans">
        <StoreShell navCategories={navCategories} initialCustomer={customer}>
          {children}
        </StoreShell>
      </body>
    </html>
  );
}
