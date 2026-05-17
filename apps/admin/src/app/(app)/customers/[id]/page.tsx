import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@repo/db';
import { PageHeader } from '@/components/shell/page-header';
import { Pill } from '@/components/ui/pill';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      orders: {
        orderBy: { placedAt: 'desc' },
        take: 20,
        select: { id: true, orderNumber: true, state: true, totalPaisa: true, placedAt: true },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { product: { select: { name: true, slug: true } } },
      },
    },
  });
  if (!customer) notFound();

  const totalRevenue = Number(customer.totalRevenuePaisa) / 100;

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader
        breadcrumbs={[
          { label: 'Growth' },
          { label: 'Customers', href: '/customers' },
          { label: customer.name ?? customer.phone },
        ]}
        title={customer.name ?? customer.phone}
        description={`${customer.totalOrders} order${customer.totalOrders === 1 ? '' : 's'} · ₹${totalRevenue.toLocaleString('en-IN')} lifetime`}
      />
      <div className="grid gap-6 px-5 py-5 md:grid-cols-3 md:px-8 md:py-6">
        <section className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-snow p-5">
            <h3 className="text-[13px] font-semibold text-ink-900">Orders</h3>
            {customer.orders.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-ink-500">No orders yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100">
                {customer.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2 text-[13px]">
                    <Link href={`/orders/${o.id}`} className="font-mono text-ink-900 hover:underline">
                      {o.orderNumber}
                    </Link>
                    <Pill tone="neutral">{o.state.replace(/_/g, ' ')}</Pill>
                    <span className="font-mono text-ink-900">₹{(o.totalPaisa / 100).toLocaleString('en-IN')}</span>
                    <span className="font-mono text-[11px] text-ink-500">
                      {new Date(o.placedAt).toLocaleDateString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-snow p-5">
            <h3 className="text-[13px] font-semibold text-ink-900">Reviews left</h3>
            {customer.reviews.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-ink-500">No reviews yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100">
                {customer.reviews.map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/p/${r.product.slug}`}
                        target="_blank"
                        className="text-[13px] text-ink-900 hover:underline"
                      >
                        {r.product.name}
                      </Link>
                      <Pill tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>
                        {r.status}
                      </Pill>
                    </div>
                    <p className="mt-1 text-[12.5px] text-ink-700">
                      {r.rating}★ — {r.title}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-snow p-5 text-[13px]">
            <h3 className="text-[13px] font-semibold text-ink-900">Contact</h3>
            <dl className="mt-3 space-y-2">
              <Row label="Phone" value={customer.phone} mono />
              <Row label="Email" value={customer.email ?? '—'} />
              <Row label="Joined" value={new Date(customer.createdAt).toLocaleDateString('en-IN')} />
            </dl>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-snow p-5 text-[13px]">
            <h3 className="text-[13px] font-semibold text-ink-900">Marketing consents</h3>
            <dl className="mt-3 space-y-2">
              <Row label="Email" value={customer.marketingConsentEmail ? 'Yes' : 'No'} />
              <Row label="SMS" value={customer.marketingConsentSms ? 'Yes' : 'No'} />
              <Row label="WhatsApp" value={customer.marketingConsentWhatsapp ? 'Yes' : 'No'} />
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">{label}</dt>
      <dd className={mono ? 'font-mono text-ink-900' : 'text-ink-900'}>{value}</dd>
    </div>
  );
}
