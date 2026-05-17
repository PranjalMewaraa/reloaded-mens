import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCustomerProfile } from '@/lib/customer-server';
import { ProfileForm } from './profile-form';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const customer = await getCustomerProfile();
  if (!customer) redirect('/account/login?next=/account/profile');
  return (
    <div className="mx-auto max-w-[560px] px-4 py-8 md:py-12">
      <p className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
        <Link href="/account" className="hover:underline">
          Account
        </Link>{' '}
        / Profile
      </p>
      <h1 className="mt-1 font-display text-[26px] font-semibold text-ink-900">Profile</h1>
      <p className="mt-1 text-[13px] text-ink-500">
        Your phone is locked — that&apos;s your login. Everything else is editable.
      </p>
      <ProfileForm initial={customer} />
    </div>
  );
}
