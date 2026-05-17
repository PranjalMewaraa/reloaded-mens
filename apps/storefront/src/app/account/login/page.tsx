import { redirect } from 'next/navigation';
import { getCustomerProfile } from '@/lib/customer-server';
import { LoginFlow } from './login-flow';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const customer = await getCustomerProfile();
  const sp = (await searchParams) ?? {};
  if (customer) {
    redirect(sp.next ?? '/account');
  }
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[420px] flex-col justify-center px-4 py-12">
      <h1 className="font-display text-[28px] font-semibold text-ink-900">Sign in</h1>
      <p className="mt-1 text-[13px] text-ink-500">
        We&apos;ll email a six-digit code to the address on your last order. SMS lands later.
      </p>
      <LoginFlow nextHref={sp.next ?? '/account'} />
    </div>
  );
}
