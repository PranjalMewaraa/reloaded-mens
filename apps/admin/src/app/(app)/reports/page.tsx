import type {
  ReportSalesByDayResponse,
  ReportSummary,
  ReportTopCustomersResponse,
  ReportTopProductsResponse,
} from '@repo/types';
import { api } from '@/lib/api';
import { ReportsView } from './reports-view';

export const metadata = { title: 'Reports' };

interface PageProps {
  searchParams?: Promise<{ from?: string; to?: string }>;
}

// Resolves the default 30-day window so the SSR data is consistent with what
// the client-side date picker will show. The api would also default if we
// passed nothing, but explicit ranges in the URL are share-able.
function resolveRange(input?: { from?: string; to?: string }) {
  const to = input?.to ?? new Date().toISOString();
  const from =
    input?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const range = resolveRange(sp);
  const qs = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

  const [summaryRes, byDayRes, productsRes, customersRes] = await Promise.all([
    api<ReportSummary>(`/admin-reports/summary${qs}`),
    api<ReportSalesByDayResponse>(`/admin-reports/sales-by-day${qs}`),
    api<ReportTopProductsResponse>(`/admin-reports/top-products${qs}&limit=10`),
    api<ReportTopCustomersResponse>(`/admin-reports/top-customers${qs}&limit=10`),
  ]);

  return (
    <ReportsView
      from={range.from}
      to={range.to}
      summary={summaryRes.body ?? null}
      salesByDay={byDayRes.body?.items ?? []}
      topProducts={productsRes.body?.items ?? []}
      topCustomers={customersRes.body?.items ?? []}
    />
  );
}
