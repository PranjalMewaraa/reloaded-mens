import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';

// All pages under (app) are authenticated and hit the database — opt out of
// static prerendering so Next.js never tries to render them at build time
// (DATABASE_URL is not available in the build environment).
export const dynamic = 'force-dynamic';
import { BottomNav } from '@/components/shell/bottom-nav';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/top-bar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col bg-bone">
      <TopBar user={user} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 pb-24 md:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
