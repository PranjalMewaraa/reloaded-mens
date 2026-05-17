// React Email template for the order confirmation. Rendered server-side via
// @react-email/render to HTML, then handed to whichever transport is wired
// (Resend in production; console-logged in dev when RESEND_API_KEY is unset).

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { OrderSnapshot } from '@repo/types';

interface Props {
  order: OrderSnapshot;
  brandName: string;
  storefrontUrl: string;
  whatsappNumber: string;
}

function rupees(paisa: number): string {
  return `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
}

function etaCopy(order: OrderSnapshot): string {
  if (!order.etaDateFrom || !order.etaDateTo) return 'Estimated delivery — we will email when shipped.';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `Estimated delivery between ${fmt(order.etaDateFrom)} and ${fmt(order.etaDateTo)}.`;
}

export function OrderConfirmationEmail({ order, brandName, storefrontUrl, whatsappNumber }: Props) {
  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    `Hi! Order ${order.orderNumber}`,
  )}`;
  return (
    <Html>
      <Head />
      <Preview>
        Order {order.orderNumber} is confirmed · {rupees(order.totalPaisa)}
      </Preview>
      <Body
        style={{
          backgroundColor: '#F9FAFB',
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          color: '#0A0A0A',
        }}
      >
        <Container style={{ maxWidth: 600, padding: '24px 24px 64px' }}>
          <Heading
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            {brandName}.
          </Heading>
          <Section style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 16, margin: 0 }}>
              Thanks, {order.contact.name.split(' ')[0]} — your order is confirmed.
            </Text>
            <Text style={{ fontSize: 14, color: '#52525B', marginTop: 8 }}>{etaCopy(order)}</Text>
          </Section>

          <Section
            style={{
              marginTop: 24,
              padding: '12px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E4E4E7',
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#71717A',
                margin: 0,
              }}
            >
              Order number
            </Text>
            <Text style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, margin: '4px 0 0' }}>
              {order.orderNumber}
            </Text>
          </Section>

          <Section style={{ marginTop: 24 }}>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '12px 0',
                  borderBottom: '1px solid #E4E4E7',
                }}
              >
                <div style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{item.productName}</Text>
                  <Text
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      color: '#71717A',
                      margin: '4px 0 0',
                    }}
                  >
                    {[item.variantLabel, item.sku].filter(Boolean).join(' · ')} × {item.quantity}
                  </Text>
                </div>
                <Text style={{ fontSize: 14, fontWeight: 500, margin: 0, minWidth: 96, textAlign: 'right' }}>
                  {rupees(item.totalPaisa)}
                </Text>
              </div>
            ))}
          </Section>

          <Section style={{ marginTop: 16 }}>
            <SummaryRow label="Subtotal" value={rupees(order.subtotalPaisa)} />
            {order.discountPaisa > 0 ? (
              <SummaryRow
                label={order.appliedCouponCode ? `Discount · ${order.appliedCouponCode}` : 'Discount'}
                value={`− ${rupees(order.discountPaisa)}`}
                tone="success"
              />
            ) : null}
            <SummaryRow
              label="Shipping"
              value={order.shippingPaisa === 0 ? 'Free' : rupees(order.shippingPaisa)}
            />
            <SummaryRow label="GST (incl.)" value={rupees(order.taxPaisa)} />
            <Hr style={{ borderColor: '#E4E4E7', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>To pay</Text>
              <Text
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: 22,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {rupees(order.totalPaisa)}
              </Text>
            </div>
          </Section>

          <Section style={{ marginTop: 24 }}>
            <Text
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#71717A',
                margin: 0,
              }}
            >
              Shipping to
            </Text>
            <Text style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6 }}>
              {order.shippingAddress.name}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{order.shippingAddress.pincode}</span>
              <br />
              {order.shippingAddress.phone}
            </Text>
          </Section>

          {order.trackingToken ? (
            <Section style={{ marginTop: 28 }}>
              <Link
                href={`${storefrontUrl}/track/${encodeURIComponent(order.orderNumber)}?t=${order.trackingToken}`}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#0A0A0A',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  padding: '12px 22px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Track your order
              </Link>
              <Text style={{ fontSize: 11, color: '#71717A', marginTop: 8 }}>
                Cancel up to packed · self-serve via the same link
              </Text>
            </Section>
          ) : null}

          <Section
            style={{
              marginTop: 28,
              backgroundColor: '#1F8A4D',
              borderRadius: 12,
              padding: '16px 18px',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 500, margin: 0 }}>
              Anything you need? WhatsApp us.
            </Text>
            <Link
              href={whatsappHref}
              style={{ color: '#FFFFFF', fontSize: 13, textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}
            >
              Open chat
            </Link>
          </Section>

          <Text style={{ fontSize: 11, color: '#71717A', marginTop: 24, lineHeight: 1.6 }}>
            You will receive another email when the order ships. Track from the link above
            or visit{' '}
            <Link href={storefrontUrl} style={{ color: '#0A0A0A' }}>
              {storefrontUrl}
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success';
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <Text style={{ fontSize: 13, color: '#52525B', margin: 0 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: tone === 'success' ? '#15803D' : '#0A0A0A', margin: 0 }}>
        {value}
      </Text>
    </div>
  );
}
