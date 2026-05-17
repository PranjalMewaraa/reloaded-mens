'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Home, Package, ShoppingBag, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

const NAV: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: Home, enabled: true },
  { label: 'Orders', href: '/orders', icon: ShoppingBag, enabled: false },
  { label: 'Products', href: '/products', icon: Box, enabled: true },
  { label: 'Stock', href: '/inventory', icon: Package, enabled: true },
  { label: 'More', href: '/more', icon: Tags, enabled: false },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 grid h-16 grid-cols-5 rounded-2xl bg-ink-900 px-1.5 py-1.5 shadow-soft-md md:hidden"
      aria-label="Primary"
    >
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const base = 'flex flex-col items-center justify-center gap-1 rounded-xl text-[10px]';
        if (!item.enabled) {
          return (
            <div key={item.href} className={cn(base, 'text-snow/30')}>
              <Icon className="h-5 w-5" />
              {item.label}
            </div>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              base,
              active ? 'bg-snow text-ink-900 font-medium' : 'text-snow/70 hover:text-snow',
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
