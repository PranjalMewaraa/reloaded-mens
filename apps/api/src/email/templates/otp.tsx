// Sprint 8 — sign-in code email. Plain layout, big code, clear TTL.

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface Props {
  code: string;
  ttlMinutes: number;
  brandName: string;
}

export function OtpEmail({ code, ttlMinutes, brandName }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`Your ${brandName} sign-in code is ${code}`}</Preview>
      <Body style={{ backgroundColor: '#fafaf7', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: 480, padding: 24, margin: '0 auto' }}>
          <Section>
            <Heading as="h1" style={{ fontSize: 20, color: '#1a1a1a' }}>
              Your {brandName} sign-in code
            </Heading>
            <Text style={{ color: '#5a5a5a', fontSize: 14, lineHeight: 1.55 }}>
              Use this code to sign in. It expires in {ttlMinutes} minutes.
            </Text>
            <div
              style={{
                marginTop: 16,
                padding: 18,
                background: '#ffffff',
                borderRadius: 12,
                border: '1px solid #e6e3dc',
                textAlign: 'center' as const,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 32,
                letterSpacing: 8,
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              {code}
            </div>
            <Text style={{ marginTop: 16, color: '#8a8a8a', fontSize: 12, lineHeight: 1.55 }}>
              Didn&apos;t request this? You can safely ignore the email — nobody can sign in
              without the code.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
