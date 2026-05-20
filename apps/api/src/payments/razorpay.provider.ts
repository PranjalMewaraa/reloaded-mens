import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from '@repo/types';
import type {
  CreateSessionInput,
  CreateSessionResult,
  PaymentProviderImpl,
} from './payment.types.js';

// Sprint 10 — Razorpay (with Route enabled) provider stub.
//
// Wires through the env so misconfigured deploys explode at boot rather
// than silently 500ing on the first checkout. The real implementation
// lands once Razorpay test creds are in `.env`:
//
//   createSession  → POST /v1/orders to Razorpay with optional transfers[]
//                     payload for the partner Route split. Returns the
//                     Checkout modal payload (key_id + razorpay_order_id +
//                     prefill) so the storefront can open the modal.
//   verifyWebhook  → HMAC-SHA256 of the raw body with RAZORPAY_WEBHOOK_SECRET.
//                     Returns false on mismatch — public webhook controller
//                     drops the request without side effects.
//
// Until then, flipping PAYMENT_PROVIDER=razorpay throws NotImplemented on
// every call. That's intentional — keeps the slot reserved so the rest of
// the system can be wired against the interface without the integration
// existing yet.
@Injectable()
export class RazorpayPaymentProvider implements PaymentProviderImpl {
  readonly name = PAYMENT_PROVIDER.RAZORPAY;
  private readonly logger = new Logger('Payments/Razorpay');
  private readonly keyId: string | undefined;
  private readonly keySecret: string | undefined;
  // Partner Route config — sourced from env on boot, but the runtime read
  // of partner.linked_account_id / partner.split_percent prefers the
  // Setting table so admins can adjust without redeploy. Sprint 10 implements
  // the Setting lookup; for now the env values are placeholders.
  private readonly partnerLinkedAccountId: string | undefined;
  private readonly partnerSplitPercent: number;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('RAZORPAY_KEY_ID')?.trim() || undefined;
    this.keySecret = config.get<string>('RAZORPAY_KEY_SECRET')?.trim() || undefined;
    // RAZORPAY_WEBHOOK_SECRET is consumed by verifyWebhook() — read here at
    // boot so the warning below fires for missing creds, but not held on
    // the instance until the real implementation lands.
    const webhookSecret = config.get<string>('RAZORPAY_WEBHOOK_SECRET')?.trim();
    this.partnerLinkedAccountId =
      config.get<string>('RAZORPAY_PARTNER_LINKED_ACCOUNT_ID')?.trim() || undefined;
    const rawPercent = config.get<string>('RAZORPAY_PARTNER_SPLIT_PERCENT');
    const parsedPercent = rawPercent ? Number(rawPercent) : NaN;
    this.partnerSplitPercent = Number.isFinite(parsedPercent) ? parsedPercent : 5;

    if (!this.keyId || !this.keySecret || !webhookSecret) {
      // Don't throw — the stub is wire-able for local dev with no env. Log
      // a clear warning so the operator knows why /checkout 500s when they
      // actually try to use this provider in prod.
      this.logger.warn(
        'Razorpay creds missing. Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + RAZORPAY_WEBHOOK_SECRET, or PAYMENT_PROVIDER=mock.',
      );
    }
    if (!this.partnerLinkedAccountId) {
      this.logger.log(
        'No RAZORPAY_PARTNER_LINKED_ACCOUNT_ID set — Route split disabled, all orders settle 100% to the main account.',
      );
    } else {
      this.logger.log(
        `Route partner config: account=${this.partnerLinkedAccountId} split=${this.partnerSplitPercent}%`,
      );
    }
  }

  createSession(_input: CreateSessionInput): Promise<CreateSessionResult> {
    return Promise.reject(
      new NotImplementedException(
        'Razorpay payment provider stub. Sprint 10 implementation pending — set PAYMENT_PROVIDER=mock for now.',
      ),
    );
  }

  verifyWebhook(_rawBody: string, _signature: string): boolean {
    throw new NotImplementedException(
      'Razorpay webhook verification not implemented. Sprint 10 ships the HMAC-SHA256 check against RAZORPAY_WEBHOOK_SECRET.',
    );
  }
}
