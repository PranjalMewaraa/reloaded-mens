import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
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
