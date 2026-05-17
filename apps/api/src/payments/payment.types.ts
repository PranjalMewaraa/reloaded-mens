import type { PaymentProvider as PaymentProviderId } from '@repo/types';

// Sprint 4 payment provider abstraction. Two impls today: MockPaymentProvider (auto-
// succeeds via self-fired webhook after a delay) and PhonePePaymentProvider (placeholder
// — Sprint 10 wires the real SDK). Swap via PAYMENT_PROVIDER env.

export interface CreateSessionInput {
  orderId: string;
  orderNumber: string;
  amountPaisa: number;
  // Absolute URL the storefront should redirect to once the provider's hosted page
  // completes. The mock provider ignores this since it self-fires its webhook.
  successRedirectUrl: string;
  // Customer info for providers that pre-fill the hosted form (PhonePe accepts a phone).
  customerPhone: string;
}

export interface CreateSessionResult {
  sessionId: string;
  // Where the storefront should redirect after POST /public/orders. For the mock it's the
  // storefront's own /checkout/processing page; PhonePe will return its hosted URL.
  redirectUrl: string;
}

export interface PaymentProviderImpl {
  readonly name: PaymentProviderId;
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  verifyWebhook(rawBody: string, signature: string): boolean;
}

// DI token. Inject via @Inject(PAYMENT_PROVIDER_TOKEN).
export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER';
