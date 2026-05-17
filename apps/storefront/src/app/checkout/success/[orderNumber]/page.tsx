import { notFound } from 'next/navigation';
import { Check, MessageCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { OrderSnapshot } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { publicApi } from '@/lib/api';
import { env } from '@/lib/env';
import { OrderSuccessCleanup } from './cleanup';

export const metadata = { title: 'Order confirmed' };

interface Props {
  params: Promise<{ orderNumber: string }>;
}

function formatINR(paisa: number): string {
  return `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
}

function formatEta(order: OrderSnapshot): string | null {
  if (!order.etaDateFrom || !order.etaDateTo) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  return `${fmt(order.etaDateFrom)} – ${fmt(order.etaDateTo)}`;
}

export default async function CheckoutSuccessPage({ params }: Props) {
  const { orderNumber } = await params;
  const res = await publicApi<OrderSnapshot>(`/public/orders/${encodeURIComponent(orderNumber)}`);
  if (!res.ok || !res.body) notFound();
  const order = res.body;
  const eta = formatEta(order);
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    `Hi! Order ${order.orderNumber}`,
  )}`;

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-10 md:px-8 md:py-16">
      <OrderSuccessCleanup />
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-[28px] font-semibold tracking-tight text-ink-900 md:text-[40px]">
          Order confirmed
        </h1>
        <p className="mt-2 text-[13px] text-ink-500">
          Thanks {order.contact.name.split(' ')[0]} — we&apos;ve started prepping your bag.
        </p>
        <Pill tone="ink" className="mt-4">
          {order.orderNumber}
        </Pill>
      </div>

      <section className="mt-8 rounded-2xl border border-ink-100 bg-snow p-5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Estimated delivery</h2>
        <p className="mt-1 font-display text-[18px] font-semibold text-ink-900">
          {eta ?? 'We will email you once it ships'}
        </p>
        <p className="mt-1 text-[12.5px] text-ink-500">
          Standard delivery to{' '}
          <span className="font-mono">{order.shippingAddress.pincode}</span>
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-100 bg-snow p-5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Your order</h2>
        <ul className="mt-3 divide-y divide-ink-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-[13px]">
              <div className="min-w-0">
                <div className="truncate text-ink-900">{item.productName}</div>
                <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
                  {[item.variantLabel, item.sku, `qty ${item.quantity}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="font-mono text-[12.5px] text-ink-900">{formatINR(item.totalPaisa)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 text-[13px]">
          <div className="flex justify-between text-ink-500">
            <span>Subtotal</span>
            <span>{formatINR(order.subtotalPaisa)}</span>
          </div>
          {order.discountPaisa > 0 ? (
            <div className="flex justify-between text-success">
              <span>{order.appliedCouponCode ? `Discount · ${order.appliedCouponCode}` : 'Discount'}</span>
              <span>− {formatINR(order.discountPaisa)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-ink-500">
            <span>Shipping</span>
            <span>{order.shippingPaisa === 0 ? 'Free' : formatINR(order.shippingPaisa)}</span>
          </div>
          <div className="my-2 border-t border-ink-100" />
          <div className="flex justify-between">
            <span className="text-[14px] font-medium text-ink-900">Paid</span>
            <span className="font-display text-[20px] font-semibold text-ink-900">
              {formatINR(order.totalPaisa)}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-100 bg-snow p-5">
        <h2 className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">Shipping to</h2>
        <p className="mt-2 text-[13px] leading-[1.55] text-ink-900">
          {order.shippingAddress.name}
          <br />
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
          <span className="font-mono">{order.shippingAddress.pincode}</span>
          <br />
          <span className="font-mono">{order.shippingAddress.phone}</span>
        </p>
      </section>

      <section className="mt-6 rounded-2xl bg-whatsapp px-5 py-4 text-snow">
        <p className="text-[13px] font-medium">Need a hand? WhatsApp the team.</p>
        <Button asChild variant="ghost" size="sm" className="mt-2 bg-snow text-ink-900">
          <a href={whatsappHref} target="_blank" rel="noopener">
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat about order {order.orderNumber}
          </a>
        </Button>
      </section>

      <div className="mt-8 flex flex-col items-center gap-2">
        {order.trackingToken ? (
          <Button asChild size="md">
            <Link
              href={`/track/${encodeURIComponent(order.orderNumber)}?t=${order.trackingToken}`}
            >
              Track your order
            </Link>
          </Button>
        ) : null}
        <Button asChild size="md" variant="outline">
          <Link href="/shop">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Keep shopping
          </Link>
        </Button>
      </div>
    </div>
  );
}
