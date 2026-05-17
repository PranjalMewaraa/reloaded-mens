import Link from 'next/link';
import { prisma } from '@repo/db';
import { getCurrentUser } from '@/lib/session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const [
    user,
    confirmedCount,
    paymentPendingCount,
    pendingRefundsCount,
    pendingReturnsCount,
    recentOrders,
  ] = await Promise.all([
      getCurrentUser(),
      prisma.order.count({ where: { state: 'confirmed', deletedAt: null } }),
      prisma.order.count({ where: { state: 'payment_pending', deletedAt: null } }),
      prisma.refundRequest.count({ where: { status: 'pending_admin_approval' } }),
      prisma.returnRequest.count({ where: { state: 'requested' } }),
      prisma.order.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          state: true,
          totalPaisa: true,
          createdAt: true,
          contactSnapshot: true,
        },
      }),
    ]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-5 py-6 md:px-8 md:py-8">
      <div>
        <div className="label-caps">Today</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink-900">
          Welcome back, {user?.name ?? 'Admin'}
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          Sprint 5 ships the full order lifecycle. Click into any order to advance the
          state, manage refunds, or print a label.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/orders?state=confirmed" className="block">
          <Card className="transition hover:border-ink-300">
            <CardHeader>
              <CardTitle className="text-[12px] font-mono uppercase tracking-caps text-ink-500">
                Confirmed orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-[32px] font-semibold text-ink-900">{confirmedCount}</div>
              <p className="mt-1 text-[12px] text-ink-500">Paid, awaiting fulfilment</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/orders?state=payment_pending" className="block">
          <Card className="transition hover:border-ink-300">
            <CardHeader>
              <CardTitle className="text-[12px] font-mono uppercase tracking-caps text-ink-500">
                Awaiting payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-[32px] font-semibold text-ink-900">{paymentPendingCount}</div>
              <p className="mt-1 text-[12px] text-ink-500">Stuck or in-flight checkouts</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/orders/refunds" className="block">
          <Card className="transition hover:border-ink-300">
            <CardHeader>
              <CardTitle className="text-[12px] font-mono uppercase tracking-caps text-ink-500">
                Refunds queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="font-display text-[32px] font-semibold text-ink-900">{pendingRefundsCount}</div>
                {pendingRefundsCount > 0 ? <Pill tone="warning" withDot>Pending approval</Pill> : null}
              </div>
              <p className="mt-1 text-[12px] text-ink-500">
                {pendingRefundsCount === 0 ? 'No requests awaiting decision.' : 'Admin approval required.'}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/orders/returns?state=requested" className="block">
          <Card className="transition hover:border-ink-300">
            <CardHeader>
              <CardTitle className="text-[12px] font-mono uppercase tracking-caps text-ink-500">
                Pending returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="font-display text-[32px] font-semibold text-ink-900">{pendingReturnsCount}</div>
                {pendingReturnsCount > 0 ? <Pill tone="warning" withDot>Awaiting approval</Pill> : null}
              </div>
              <p className="mt-1 text-[12px] text-ink-500">
                {pendingReturnsCount === 0 ? 'Inbox is empty.' : 'Review photos + decide.'}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[16px]">Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-[13px] text-ink-500">No orders yet — try the storefront checkout.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentOrders.map((o) => {
                const contact = o.contactSnapshot as { name?: string } | null;
                return (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.orderNumber}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-ink-50/40"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[13px] text-ink-900">{o.orderNumber}</div>
                        <div className="text-[12px] text-ink-500">
                          {contact?.name ?? 'Anonymous'} ·{' '}
                          {new Date(o.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Pill tone={toneForState(o.state)} withDot>
                          {o.state.replace(/_/g, ' ')}
                        </Pill>
                        <span className="font-mono text-[13px] text-ink-900">
                          ₹{Math.round(o.totalPaisa / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function toneForState(
  state: string,
): 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'clay' {
  switch (state) {
    case 'payment_pending':
      return 'warning';
    case 'confirmed':
      return 'info';
    case 'packed':
      return 'clay';
    case 'shipped':
    case 'out_for_delivery':
      return 'info';
    case 'delivered':
      return 'success';
    case 'cancelled':
    case 'payment_failed':
      return 'danger';
    case 'refunded':
      return 'neutral';
    default:
      return 'neutral';
  }
}
