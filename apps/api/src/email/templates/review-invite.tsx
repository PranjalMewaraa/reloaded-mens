// Sprint 8 — "How was it?" post-delivery email. One row per orderItem with a
// tokenized link to /review/<orderItemId>?t=<token>.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { ReviewInviteItem } from '../email.types.js';

interface Props {
  customerName: string;
  orderNumber: string;
  items: ReviewInviteItem[];
  brandName: string;
}

export function ReviewInviteEmail({ customerName, orderNumber, items, brandName }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`How was your ${brandName} order ${orderNumber}?`}</Preview>
      <Body style={{ backgroundColor: '#fafaf7', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: 560, padding: 24, margin: '0 auto' }}>
          <Section>
            <Heading as="h1" style={{ fontSize: 22, color: '#1a1a1a' }}>
              {customerName ? `${customerName}, ` : ''}how was order {orderNumber}?
            </Heading>
            <Text style={{ color: '#5a5a5a', fontSize: 14, lineHeight: 1.55 }}>
              A quick review helps other shoppers — and it only takes a minute.
            </Text>
          </Section>

          {items.map((item) => (
            <Section
              key={item.orderItemId}
              style={{
                marginTop: 12,
                padding: 16,
                background: '#ffffff',
                borderRadius: 12,
                border: '1px solid #e6e3dc',
              }}
            >
              <Text style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                {item.productName}
              </Text>
              {item.variantLabel ? (
                <Text
                  style={{
                    margin: '4px 0 0',
                    fontSize: 11,
                    color: '#8a8a8a',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    textTransform: 'uppercase' as const,
                    letterSpacing: 1,
                  }}
                >
                  {item.variantLabel}
                </Text>
              ) : null}
              <Button
                href={item.reviewUrl}
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  padding: '8px 14px',
                  background: '#1a1a1a',
                  color: '#fafaf7',
                  borderRadius: 8,
                  fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                Leave a review
              </Button>
              <Text style={{ marginTop: 8, fontSize: 11, color: '#8a8a8a' }}>
                Or open: <Link href={item.reviewUrl}>{item.reviewUrl}</Link>
              </Text>
            </Section>
          ))}

          <Text style={{ marginTop: 20, fontSize: 11, color: '#8a8a8a' }}>
            This link is unique to your order. If you didn&apos;t buy this product, just
            ignore the email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
