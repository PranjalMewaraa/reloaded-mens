import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import { PAYMENT_PROVIDER } from '@repo/types';
import type {
  CreateSessionInput,
  CreateSessionResult,
  PaymentProviderImpl,
  SessionTransfer,
} from './payment.types.js';

// Razorpay (with optional Route enabled) payment provider.
//
// Flow on the api side:
//   1. createSession() — POSTs /v1/orders to Razorpay. If transfers are
//      passed in CreateSessionInput, builds the Route split payload.
//      Returns the rzp_order_id + a `checkoutPayload` the storefront feeds
//      into the Razorpay Checkout JS modal.
//   2. The storefront opens the modal. User pays.
//   3. Modal returns { razorpay_payment_id, razorpay_order_id, signature }.
//      Storefront posts these to a new endpoint (verifyPaymentSignature
//      lives on the controller; this provider just exposes the verify
//      method as a static-ish helper).
//   4. Razorpay also POSTs a webhook to our public webhook endpoint with
//      the same event. verifyWebhook() checks the raw body's HMAC-SHA256
//      against RAZORPAY_WEBHOOK_SECRET so we don't accept forged events.
//
// Route specifics:
//   - When RAZORPAY_PARTNER_LINKED_ACCOUNT_ID is empty, no transfers[]
//     are sent — money settles 100% to the main account. Useful for the
//     pre-Route-activation testing window.
//   - When set, every order carries a transfers[] with one entry for the
//     partner. Razorpay disburses at capture time; the amounts settle
//     independently to each linked account.
//
// Tested in test mode against rzp_test_xxx keys without Route activation —
// the createSession() call works, transfers[] is silently ignored by
// Razorpay until Route is on. So this provider is wire-able and verifiable
// end-to-end today; the Route-specific behaviour kicks in once the linked
// account is approved.

interface RazorpaySdkOrder {
  id: string;
  amount: number | string;
  currency: string;
  receipt?: string;
  status: string;
  notes?: Record<string, string>;
}

interface RazorpaySdkOrdersResource {
  create(params: Record<string, unknown>): Promise<RazorpaySdkOrder>;
}

// The SDK's TS types are loose — narrow them locally so the rest of the
// service stays typed without us importing from `razorpay/dist/types/*`.
interface RazorpaySdk {
  orders: RazorpaySdkOrdersResource;
}

@Injectable()
export class RazorpayPaymentProvider implements PaymentProviderImpl {
  readonly name = PAYMENT_PROVIDER.RAZORPAY;
  private readonly logger = new Logger('Payments/Razorpay');
  private readonly keyId: string | undefined;
  private readonly keySecret: string | undefined;
  private readonly webhookSecret: string | undefined;
  // Lazy-initialised SDK client. Built on first use so a missing-creds
  // boot doesn't crash the api — the stub-style "warning + throw on call"
  // experience is preserved.
  private rzp: RazorpaySdk | null = null;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('RAZORPAY_KEY_ID')?.trim() || undefined;
    this.keySecret = config.get<string>('RAZORPAY_KEY_SECRET')?.trim() || undefined;
    this.webhookSecret = config.get<string>('RAZORPAY_WEBHOOK_SECRET')?.trim() || undefined;

    if (!this.keyId || !this.keySecret || !this.webhookSecret) {
      this.logger.warn(
        'Razorpay creds missing. Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + RAZORPAY_WEBHOOK_SECRET, or PAYMENT_PROVIDER=mock.',
      );
    }
    this.logger.log(
      `Razorpay provider booted ${this.keyId ? `(${this.keyId.startsWith('rzp_test_') ? 'TEST' : 'LIVE'} mode)` : '(missing creds — calls will throw)'}`,
    );
  }

  // PUBLIC KEY ID — the storefront needs this to open the Checkout modal.
  // Exposing only the public-safe id, never the secret.
  get publicKeyId(): string | undefined {
    return this.keyId;
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const client = this.getClient();

    // Build the Razorpay Orders create payload. Amount must be in paisa.
    const params: Record<string, unknown> = {
      amount: input.amountPaisa,
      currency: 'INR',
      // receipt is shown in the Razorpay dashboard for cross-reference.
      // Max 40 chars — RLD-NNNNNN well under that.
      receipt: input.orderNumber,
      notes: {
        order_id: input.orderId,
        order_number: input.orderNumber,
      },
    };

    // Route split — only attached when transfers were provided. Each entry
    // routes a slice of the captured amount to a linked account at
    // settlement. Razorpay also accepts `on_hold` if you want to delay
    // disbursement to the partner until the order is delivered (useful
    // for marketplace setups; not used here).
    if (input.transfers && input.transfers.length > 0) {
      params.transfers = input.transfers.map((t) => ({
        account: t.accountId,
        amount: t.amountPaisa,
        currency: 'INR',
        notes: t.notes ?? {},
        on_hold: 0,
      }));
      this.logger.log(
        `createSession ${input.orderNumber} amount=${input.amountPaisa} transfers=${describeTransfers(input.transfers)}`,
      );
    }

    let rzpOrder: RazorpaySdkOrder;
    try {
      rzpOrder = await client.orders.create(params);
    } catch (err) {
      // Razorpay errors carry a `statusCode` + `error.description` shape.
      // Rethrow as ServiceUnavailable so the global filter logs the stack
      // and the storefront sees a useful message rather than 500/empty.
      this.logger.error(
        `Razorpay orders.create failed for ${input.orderNumber}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new ServiceUnavailableException(
        'Could not initialise payment with Razorpay. Try again in a moment.',
      );
    }

    // The Checkout modal payload the storefront feeds straight into the
    // Razorpay JS SDK. key_id is public-safe — the secret stays here.
    const checkoutPayload: Record<string, unknown> = {
      key: this.keyId,
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      name: 'Reloaded Mens',
      description: `Order ${input.orderNumber}`,
      prefill: {
        contact: input.customerPhone,
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
      },
      notes: {
        order_id: input.orderId,
        order_number: input.orderNumber,
      },
      // Theme + behavior knobs — keep minimal for now.
      theme: { color: '#0A0A0A' },
    };

    return {
      sessionId: rzpOrder.id,
      // The storefront stays on /checkout/payment when the provider is
      // razorpay — it opens the modal locally rather than navigating
      // anywhere. Returning the same route is a no-op redirect that
      // signals "stay put, use checkoutPayload."
      redirectUrl: `/checkout/payment`,
      checkoutPayload,
    };
  }

  // Webhook signature verification. Razorpay POSTs the raw body to our
  // registered webhook URL with header `x-razorpay-signature: <hex>`.
  // The signature is HMAC-SHA256(rawBody) with the webhook secret.
  verifyWebhook(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.error('verifyWebhook called but RAZORPAY_WEBHOOK_SECRET is unset');
      return false;
    }
    if (!signature) return false;
    try {
      const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
      return safeStrEqual(expected, signature);
    } catch (err) {
      this.logger.error(
        'Webhook signature verification crashed',
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  // Modal-callback signature verification — different secret + different
  // payload than the webhook. After the Checkout modal completes, the
  // storefront posts { razorpay_payment_id, razorpay_order_id, signature }
  // back to us. The signature is HMAC-SHA256(`${order_id}|${payment_id}`)
  // with the KEY SECRET (not the webhook secret).
  verifyPaymentSignature(args: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    signature: string;
  }): boolean {
    if (!this.keySecret) {
      this.logger.error('verifyPaymentSignature called but RAZORPAY_KEY_SECRET is unset');
      return false;
    }
    if (!args.signature) return false;
    try {
      const expected = createHmac('sha256', this.keySecret)
        .update(`${args.razorpayOrderId}|${args.razorpayPaymentId}`)
        .digest('hex');
      return safeStrEqual(expected, args.signature);
    } catch (err) {
      this.logger.error(
        'Payment signature verification crashed',
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  // Lazy-build the SDK client. Throws if creds are missing, so any call
  // path that depends on Razorpay surfaces the misconfiguration as a
  // 503 rather than a cryptic "cannot read property X of undefined".
  private getClient(): RazorpaySdk {
    if (this.rzp) return this.rzp;
    if (!this.keyId || !this.keySecret) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET or switch PAYMENT_PROVIDER=mock.',
      );
    }
    // The Razorpay SDK uses CommonJS; TS sees its default export as the
    // constructor we want. `unknown` cast keeps strict-mode happy.
    const RazorpayCtor = Razorpay as unknown as new (opts: {
      key_id: string;
      key_secret: string;
    }) => RazorpaySdk;
    this.rzp = new RazorpayCtor({ key_id: this.keyId, key_secret: this.keySecret });
    return this.rzp;
  }
}

// Constant-time string equality so signature comparison isn't subject to
// timing attacks. Buffers must be the same length — wrap shorter strings
// in a no-match path.
function safeStrEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function describeTransfers(ts: SessionTransfer[]): string {
  return ts.map((t) => `${t.accountId}:${t.amountPaisa}`).join(',');
}
