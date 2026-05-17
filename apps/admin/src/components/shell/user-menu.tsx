'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/app/(app)/actions';

interface Props {
  user: { name: string; email: string; role: string };
}

export function UserMenu({ user }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSignOut() {
    startTransition(async () => {
      await logoutAction();
      toast.success('Signed out');
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-ink-900 hover:bg-ink-100"
        >
          <UserRound className="h-4 w-4" />
          <span className="hidden text-[13px] sm:inline">{user.name}</span>
          <span className="ml-1 rounded-xs bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-caps text-ink-500">
            {user.role}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-900">{user.name}</span>
            <span className="text-[11.5px] text-ink-500">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} disabled={pending} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          {pending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
