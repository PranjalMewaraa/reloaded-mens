import { getCurrentUser } from '@/lib/session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-5 py-6 md:px-8 md:py-8">
      <div>
        <div className="label-caps">Today</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink-900">
          Welcome back, {user?.name ?? 'Admin'}
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          Sprint 2 brings catalog management. The real dashboard widgets land in Sprint 9 once
          orders and reports exist.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[16px]">Sprint 1 — Shipped</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-[13px] text-ink-500">
            <li>• Email + password authentication (bcrypt)</li>
            <li>• Optional TOTP two-factor (bypass toggle in env)</li>
            <li>• JWT access + refresh in HttpOnly cookies</li>
            <li>• Audit log entry on every auth action</li>
            <li>• 10-model data foundation (admin, customer, address, catalog, inventory, audit)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
