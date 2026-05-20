'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import type {
  ReportSalesByDayItem,
  ReportSummary,
  ReportTopCustomerItem,
  ReportTopProductItem,
} from '@repo/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  from: string;
  to: string;
  summary: ReportSummary | null;
  salesByDay: ReportSalesByDayItem[];
  topProducts: ReportTopProductItem[];
  topCustomers: ReportTopCustomerItem[];
}

// Quick-range buttons that bracket the most common windows. "Custom" just
// leaves whatever date inputs the user already chose.
const PRESETS: Array<{ label: string; days: number }> = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function formatINR(paisa: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paisa / 100);
}

function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function ReportsView({
  from,
  to,
  summary,
  salesByDay,
  topProducts,
  topCustomers,
}: Props) {
  const router = useRouter();
  const [fromInput, setFromInput] = React.useState(toDateInput(from));
  const [toInput, setToInput] = React.useState(toDateInput(to));

  function applyRange(fromIso: string, toIso: string) {
    const qs = new URLSearchParams({ from: fromIso, to: toIso });
    router.push(`/reports?${qs.toString()}`);
  }

  function onApply() {
    // Convert the YYYY-MM-DD strings back to ISO. Treat `from` as start of
    // day and `to` as end of day so the picked range is inclusive.
    const fromIso = new Date(`${fromInput}T00:00:00.000Z`).toISOString();
    const toIso = new Date(`${toInput}T23:59:59.999Z`).toISOString();
    applyRange(fromIso, toIso);
  }

  function onPreset(days: number) {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
    applyRange(fromDate.toISOString(), toDate.toISOString());
  }

  // CSV download — opens the api endpoint in a new tab; the controller sets
  // Content-Disposition: attachment so the browser writes the file straight
  // out without ever rendering it.
  function downloadCsv(type: 'sales-by-day' | 'top-products' | 'top-customers') {
    const qs = new URLSearchParams({ from, to, type });
    // Need the base API URL because the CSV endpoint isn't behind a Next.js
    // route — it's a direct admin-reports/export.csv on the api.
    const base = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? '';
    const url = `${base}/api/v1/admin-reports/export.csv?${qs.toString()}`;
    // Open in a new tab so the auth cookies flow. The server sets the
    // attachment header → browser shows download prompt or saves silently.
    window.open(url, '_blank');
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-900">
            Reports
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-600">
            Sales, top products, and top customers for the selected window. All
            sections respect the date range; CSV exports use the same.
          </p>
        </div>
      </header>

      {/* Date range controls */}
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-ink-100 bg-snow p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="from-date" className="text-[11.5px]">
            From
          </Label>
          <Input
            id="from-date"
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="to-date" className="text-[11.5px]">
            To
          </Label>
          <Input
            id="to-date"
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <Button onClick={onApply}>Apply</Button>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button key={p.days} variant="outline" size="sm" onClick={() => onPreset(p.days)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <SummaryStat label="Revenue" value={summary ? formatINR(summary.totalRevenuePaisa) : '—'} />
        <SummaryStat label="Orders" value={summary ? summary.orderCount.toLocaleString('en-IN') : '—'} />
        <SummaryStat label="AOV" value={summary ? formatINR(summary.averageOrderValuePaisa) : '—'} />
        <SummaryStat
          label="Refunded"
          value={summary ? formatINR(summary.refundedPaisa) : '—'}
        />
        <SummaryStat
          label="New customers"
          value={summary ? summary.newCustomerCount.toLocaleString('en-IN') : '—'}
        />
        <SummaryStat
          label="Return rate"
          value={summary ? `${summary.returnRatePercent}%` : '—'}
        />
      </section>

      {/* Sales by day */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-[18px] font-semibold text-ink-900">Sales by day</h2>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('sales-by-day')}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
        <Card className="overflow-hidden">
          {salesByDay.length === 0 ? (
            <div className="p-8 text-center text-[12.5px] text-ink-500">
              No paid orders in this window.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[11.5px] uppercase tracking-caps text-ink-500">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Orders</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {salesByDay.map((r) => (
                  <tr key={r.date} className="border-b border-ink-100 last:border-b-0">
                    <td className="px-4 py-2 font-mono text-[12.5px]">{r.date}</td>
                    <td className="px-4 py-2 text-right">{r.orderCount}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatINR(r.revenuePaisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      {/* Top products */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-[18px] font-semibold text-ink-900">Top products</h2>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('top-products')}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
        <Card className="overflow-hidden">
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-[12.5px] text-ink-500">No data in this window.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[11.5px] uppercase tracking-caps text-ink-500">
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 text-right font-medium">Units</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.productId} className="border-b border-ink-100 last:border-b-0">
                    <td className="px-4 py-2">{p.productName}</td>
                    <td className="px-4 py-2 text-right">{p.unitsSold}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(p.revenuePaisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      {/* Top customers */}
      <section className="mt-8 pb-12">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-[18px] font-semibold text-ink-900">Top customers</h2>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('top-customers')}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
        <Card className="overflow-hidden">
          {topCustomers.length === 0 ? (
            <div className="p-8 text-center text-[12.5px] text-ink-500">No data in this window.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[11.5px] uppercase tracking-caps text-ink-500">
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 text-right font-medium">Orders</th>
                  <th className="px-4 py-2 text-right font-medium">Total spent</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c.customerId} className="border-b border-ink-100 last:border-b-0">
                    <td className="px-4 py-2">{c.name ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-[12px]">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ''}
                    </td>
                    <td className="px-4 py-2 text-right">{c.orderCount}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatINR(c.totalSpentPaisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">{label}</div>
      <div className="mt-1 font-display text-[20px] font-semibold tracking-tight text-ink-900">
        {value}
      </div>
    </Card>
  );
}
