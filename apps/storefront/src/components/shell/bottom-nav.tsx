'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Heart, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/', label: 'Home', icon: Home, enabled: true },
  { href: '/shop', label: 'Shop', icon: ShoppingBag, enabled: true },
  { href: '/saved', label: 'Saved', icon: Heart, enabled: false },
  { href: '/account', label: 'Account', icon: User, enabled: false },
];

// Mobile-only bottom tab bar. Sticky at the bottom with a subtle elevation; mirrors the
// MOOL spec (4 items: Home / Shop / Saved / Account).
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-ink-100 bg-snow/95 backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(`${item.href}/`));
        const base =
          'flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium';
        if (!item.enabled) {
          return (
            <span key={item.href} className={cn(base, 'text-ink-300')}>
              <Icon className="h-5 w-5" />
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(base, isActive ? 'text-ink-900' : 'text-ink-500')}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
