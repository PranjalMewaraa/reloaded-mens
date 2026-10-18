import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reloaded Mens POS',
  description: 'Point of Sale — Reloaded Mens',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
