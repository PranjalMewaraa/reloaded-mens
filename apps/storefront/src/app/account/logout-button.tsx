'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCustomer } from '@/lib/customer-context';
import { logoutCustomer } from '@/lib/customer-api';

export function LogoutButton() {
  const router = useRouter();
  const { setCustomer } = useCustomer();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await logoutCustomer();
        setCustomer(null);
        toast.success('Signed out');
        router.push('/');
      }}
    >
      <LogOut className="mr-1 h-3.5 w-3.5" />
      Sign out
    </Button>
  );
}
