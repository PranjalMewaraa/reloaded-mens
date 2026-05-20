import { redirect } from 'next/navigation';
import type { AdminStaffListResponse } from '@repo/types';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { StaffList } from './staff-list';

export const metadata = { title: 'Staff' };

// Admins only. RolesGuard at the api enforces the same rule server-side; this
// SSR check just renders a friendlier "permission denied" experience instead
// of letting the user hit a blank/broken page when the api 403s.
export default async function StaffPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/staff');
  if (me.role !== 'admin') {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-10">
        <h1 className="font-display text-[24px] font-semibold text-ink-900">Staff</h1>
        <p className="mt-2 text-[13px] text-ink-600">
          Only admins can manage staff accounts. Ask your admin to grant you access.
        </p>
      </div>
    );
  }

  const res = await api<AdminStaffListResponse>('/admin-staff');
  const items = res.ok && res.body ? res.body.items : [];

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-900">
            Staff
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-600">
            Invite teammates and scope what they can touch. Admins see and do everything;
            staff only see the modules you tick below.
          </p>
        </div>
      </header>

      <StaffList items={items} currentAdminId={me.id} />
    </div>
  );
}
