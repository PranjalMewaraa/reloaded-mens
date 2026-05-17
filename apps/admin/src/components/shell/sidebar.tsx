'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Home,
  Package,
  Percent,
  ShoppingBag,
  Tags,
  UserRound,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home, enabled: true },
      { label: 'Orders', href: '/orders', icon: ShoppingBag, enabled: false },
      { label: 'Inventory', href: '/inventory', icon: Package, enabled: true },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { label: 'Products', href: '/products', icon: Box, enabled: true },
      { label: 'Categories', href: '/categories', icon: Tags, enabled: true },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Customers', href: '/customers', icon: Users, enabled: false },
      { label: 'Leads', href: '/leads', icon: UserRound, enabled: false },
      { label: 'Promotions', href: '/promotions', icon: Percent, enabled: false },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 self-stretch border-r border-ink-900 bg-ink-900 text-snow md:flex md:flex-col">
      <nav className="flex flex-col gap-4 overflow-y-auto p-3">
        {SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <div className="px-2 pb-1 font-mono text-[10px] uppercase tracking-caps text-ink-400">
              {section.label}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const base =
                'flex h-9 items-center justify-between rounded-md px-2.5 text-[12.5px] transition-colors';
              if (!item.enabled) {
                return (
                  <div
                    key={item.href}
                    className={cn(base, 'cursor-not-allowed text-snow/30')}
                    title="Ships in a later sprint"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    base,
                    active
                      ? 'bg-snow font-medium text-ink-900'
                      : 'text-snow/80 hover:bg-snow/10 hover:text-snow',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
