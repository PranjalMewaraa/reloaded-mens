import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { LoginForm } from './login-form';

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  if (user) {
    redirect(sp.next && sp.next.startsWith('/') ? sp.next : '/dashboard');
  }
  return <LoginForm next={sp.next} />;
}
