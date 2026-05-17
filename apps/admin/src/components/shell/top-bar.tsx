import Link from 'next/link';
import { UserMenu } from './user-menu';

interface Props {
  user: { name: string; email: string; role: string };
}

export function TopBar({ user }: Props) {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-ink-100 bg-bone/85 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-5 md:px-8">
        <Link href="/dashboard" className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight text-ink-900">Reloaded.</span>
          <span className="label-caps">admin</span>
        </Link>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
