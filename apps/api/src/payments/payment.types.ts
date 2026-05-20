import type { PaymentProvider as PaymentProviderId } from '@repo/types';

// Payment provider abstraction. Three impls available:
//   - MockPaymentProvider — Sprint 4, auto-succeeds via self-fired webhook
//   - RazorpayPaymentProvider — Sprint 10, lands the real Razorpay SDK +
//                                Route split for the partner share
//   - <future PhonePe etc.>     — same interface, different driver
// Swap via PAYMENT_PROVIDER env (mock | razorpay).

// One leg of a Route split. Razorpay disburses `amountPaisa` to the
// linked account `accountId` at capture time. notes flow through to the
// transfer record so reconciliation against the Razorpay dashboard is
// grep-able by order number.
export interface SessionTransfer {
  accountId: string; // Razorpay linked account id, `acc_xxx`
  amountPaisa: number;
  // Free-form per-transfer metadata. Razorpay enforces a 15-key cap and
  // ≤256 chars per value.
  notes?: Record<string, string>;
}

export interface CreateSessionInput {
  orderId: string;
  orderNumber: string;
  amountPaisa: number;
  // Absolute URL the storefront should redirect to once the provider's hosted page
  // completes. The mock provider ignores this since it self-fires its webhook.
  successRedirectUrl: string;
  // Customer info for providers that pre-fill the hosted form (Razorpay accepts
  // phone + email on the Checkout modal).
  customerPhone: string;
  customerEmail?: string;
  // Optional Route split — when present, the provider builds a transfers[]
  // payload alongside the order. Mock + non-Route providers ignore this.
  transfers?: SessionTransfer[];
}

export interface CreateSessionResult {
  sessionId: string;
  // Where the storefront should redirect after POST /public/orders. For the mock it's the
  // storefront's own /checkout/processing page; Razorpay returns a modal-open payload.
  redirectUrl: string;
  // Optional payload the storefront needs to open the Razorpay Checkout modal —
  // key_id + amount + order_id + name + prefill. Mock leaves this undefined.
  checkoutPayload?: Record<string, unknown>;
}

export interface PaymentProviderImpl {
  readonly name: PaymentProviderId;
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  verifyWebhook(rawBody: string, signature: string): boolean;
}

// DI token. Inject via @Inject(PAYMENT_PROVIDER_TOKEN).
export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER';
