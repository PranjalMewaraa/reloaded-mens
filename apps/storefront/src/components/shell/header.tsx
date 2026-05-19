'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, MapPin, Search as SearchIcon, ShoppingBag, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-context';
import { useCustomer } from '@/lib/customer-context';
import { env } from '@/lib/env';
import { usePincode } from '@/lib/pincode-context';
import { cn } from '@/lib/utils';

interface NavCategory {
  slug: string;
  name: string;
}

interface HeaderProps {
  navCategories: NavCategory[];
  onChangePincode: () => void;
}

// Storefront header. Mobile pattern from MOOL spec:
// - Top row: hamburger / logo / search + bag
// - Pincode strip below (only when set)
// Desktop pattern:
// - Announcement bar
// - Nav row with logo center, links left, pincode/search/bag right
export function Header({ navCategories, onChangePincode }: HeaderProps) {
  const { pincode } = usePincode();
  const { totalQuantity } = useCart();
  const { customer } = useCustomer();
  const [navOpen, setNavOpen] = React.useState(false);
  const accountHref = customer ? '/account' : '/account/login';
  const accountLabel = customer ? 'Account' : 'Sign in';

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-bone/90 backdrop-blur-md">
      {/* (The old static desktop announcement bar lived here. Replaced by the
          animated global Marquee mounted from store-shell.tsx — that one is
          visible on all breakpoints, so this duplicate is gone.) */}

      {/* Mobile top row */}
      <div className="flex h-14 items-center justify-between px-4 md:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-ink-900"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="font-display text-[22px] font-semibold tracking-tight text-ink-900">
          {env.NEXT_PUBLIC_BRAND_NAME}.
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/search"
            className="flex h-10 w-10 items-center justify-center rounded-md text-ink-900"
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </Link>
          <Link
            href={accountHref}
            className="flex h-10 w-10 items-center justify-center rounded-md text-ink-900"
            aria-label={accountLabel}
          >
            <User className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-ink-900"
            aria-label={totalQuantity > 0 ? `Cart (${totalQuantity})` : 'Cart'}
          >
            <ShoppingBag className="h-5 w-5" />
            {totalQuantity > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 font-mono text-[10px] font-medium text-snow">
                {totalQuantity}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {/* Desktop nav row */}
      <div className="mx-auto hidden h-16 max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-8 md:grid">
        <nav className="flex items-center gap-6 text-[13px] text-ink-700">
          {navCategories.slice(0, 5).map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className="hover:text-ink-900">
              {c.name}
            </Link>
          ))}
          <Link href="/visit" className="hover:text-ink-900">
            Visit store
          </Link>
        </nav>
        <Link href="/" className="justify-self-center font-display text-[28px] font-semibold tracking-tight text-ink-900">
          {env.NEXT_PUBLIC_BRAND_NAME}.
        </Link>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onChangePincode}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-snow px-3 py-1.5 text-[12px] text-ink-700 hover:border-ink-900"
          >
            <MapPin className="h-3.5 w-3.5" />
            {pincode ? (
              <>
                <span className="font-mono">{pincode}</span>
                <span className="text-ink-400">·</span>
                <span className="text-ink-400">change</span>
              </>
            ) : (
              <span>Set pincode</span>
            )}
          </button>
          <Link
            href="/search"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-900 hover:bg-ink-50"
            aria-label="Search"
          >
            <SearchIcon className="h-4 w-4" />
          </Link>
          <Link
            href={accountHref}
            className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-ink-900 hover:bg-ink-50"
            aria-label={accountLabel}
          >
            <User className="h-4 w-4" />
            <span className="hidden lg:inline">{accountLabel}</span>
          </Link>
          <Link
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-900 hover:bg-ink-50"
            aria-label={totalQuantity > 0 ? `Cart (${totalQuantity})` : 'Cart'}
          >
            <ShoppingBag className="h-4 w-4" />
            {totalQuantity > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 font-mono text-[10px] font-medium text-snow">
                {totalQuantity}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {/* Pincode strip — mobile only, hidden until set */}
      {pincode ? (
        <button
          type="button"
          onClick={onChangePincode}
          className="flex w-full items-center justify-center gap-2 border-t border-ink-100 bg-snow/70 py-1.5 text-[11.5px] text-ink-700 md:hidden"
        >
          <MapPin className="h-3.5 w-3.5" />
          Delivering to <span className="font-mono">{pincode}</span>
          <span className="text-ink-400">·</span>
          <span className="text-ink-400 underline-offset-2 hover:underline">change</span>
        </button>
      ) : null}

      {/* Mobile drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="right" className="flex flex-col p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
            <SheetTitle>Shop</SheetTitle>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-500"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {navCategories.map((c) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                onClick={() => setNavOpen(false)}
                className={cn(
                  'flex h-11 items-center rounded-md px-3 text-[14px] text-ink-900 hover:bg-ink-50',
                )}
              >
                {c.name}
              </Link>
            ))}
          </nav>
          <div className="mt-auto p-5">
            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => {
                setNavOpen(false);
                onChangePincode();
              }}
            >
              <MapPin className="mr-2 h-4 w-4" />
              {pincode ? `Delivering to ${pincode}` : 'Enter pincode'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
