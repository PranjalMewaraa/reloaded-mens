import Link from 'next/link';
import { Users } from 'lucide-react';
import { prisma } from '@repo/db';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';

export const metadata = { title: 'Customers' };

interface PageProps {
  searchParams?: Promise<{ q?: string; page?: string }>;
}

// Server Component reading Prisma directly — read-only list, no API hop needed.
// Sprint 9 polish will swap this for an /admin-customers endpoint if filtering /
// audit needs grow.
export default async function CustomersPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const page = sp.page ? Math.max(1, Number(sp.page) || 1) : 1;
  const limit = 25;
  const where = sp.q
    ? {
        OR: [
          { phone: { contains: sp.q } },
          { name: { contains: sp.q, mode: 'insensitive' as const } },
          { email: { contains: sp.q, mode: 'insensitive' as const } },
        ],
        deletedAt: null,
      }
    : { deletedAt: null };

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        orders: { select: { placedAt: true }, orderBy: { placedAt: 'desc' }, take: 1 },
      },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Growth' }, { label: 'Customers' }]}
        title="Customers"
        description={`${total} customer${total === 1 ? '' : 's'} on file.`}
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="No customers yet"
            description="Customers are created automatically the first time someone places an order or signs in."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-snow">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 text-left font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="py-2.5">Name</th>
                  <th className="py-2.5">Email</th>
                  <th className="py-2.5 text-right">Orders</th>
                  <th className="py-2.5 text-right">Revenue</th>
                  <th className="py-2.5">Last order</th>
                  <th className="py-2.5">Consents</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-ink-50 last:border-b-0">
                    <td className="px-4 py-2.5 font-mono text-ink-900">
                      <Link href={`/customers/${c.id}`} className="hover:underline">
                        {c.phone}
                      </Link>
                    </td>
                    <td className="py-2.5 text-ink-900">{c.name ?? '—'}</td>
                    <td className="py-2.5 text-ink-500">{c.email ?? '—'}</td>
                    <td className="py-2.5 text-right text-ink-900">{c.totalOrders}</td>
                    <td className="py-2.5 text-right font-mono text-ink-900">
                      ₹{(Number(c.totalRevenuePaisa) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-ink-500">
                      {c.orders[0]?.placedAt
                        ? new Date(c.orders[0].placedAt).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex gap-1">
                        {c.marketingConsentEmail ? <Pill tone="success">E</Pill> : null}
                        {c.marketingConsentSms ? <Pill tone="success">S</Pill> : null}
                        {c.marketingConsentWhatsapp ? <Pill tone="success">W</Pill> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
