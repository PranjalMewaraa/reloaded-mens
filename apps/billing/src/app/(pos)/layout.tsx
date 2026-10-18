import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Receipt, LogOut } from 'lucide-react';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { logoutAction } from '@/app/login/actions';

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE)?.value;
  const email = cookieValue ? verifySession(cookieValue) : null;

  if (!email) redirect('/login');

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f]">
      {/* Top Nav */}
      <nav className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Reloaded Mens POS</span>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-[#222] transition-colors text-sm font-medium"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>POS</span>
          </Link>
          <Link
            href="/orders"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-[#222] transition-colors text-sm font-medium"
          >
            <Receipt className="w-4 h-4" />
            <span>Orders</span>
          </Link>

          <div className="w-px h-5 bg-[#2a2a2a] mx-1" />

          <span className="text-xs text-zinc-500 hidden sm:block mr-1">{email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-[#222] transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </nav>

      <main className="flex-1">{children}</main>
    </div>
  );
}
