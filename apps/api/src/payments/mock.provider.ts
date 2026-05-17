import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import { PAYMENT_PROVIDER } from '@repo/types';
import type {
  CreateSessionInput,
  CreateSessionResult,
  PaymentProviderImpl,
} from './payment.types.js';

// MockPaymentProvider:
// - createSession() generates a session id and schedules a self-call to the mock
//   webhook endpoint after MOCK_PAYMENT_DELAY_MS. Captures or fails based on
//   MOCK_PAYMENT_AUTO_SUCCEED.
// - verifyWebhook() validates a HMAC-SHA256 signature of `${sessionId}.${status}` so
//   the public webhook endpoint can't be hit from outside the process.
//
// The self-call is intentionally fire-and-forget (setTimeout + fetch). In production a
// real provider replaces this with its own callback infrastructure.
@Injectable()
export class MockPaymentProvider implements PaymentProviderImpl {
  readonly name = PAYMENT_PROVIDER.MOCK;
  private readonly logger = new Logger('Payments/Mock');
  private readonly secret: string;
  private readonly autoSucceed: boolean;
  private readonly delayMs: number;
  private readonly publicApiUrl: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('MOCK_PAYMENT_WEBHOOK_SECRET') ?? 'dev-mock-secret';
    this.autoSucceed = (config.get<string>('MOCK_PAYMENT_AUTO_SUCCEED') ?? 'true') !== 'false';
    const delay = Number.parseInt(config.get<string>('MOCK_PAYMENT_DELAY_MS') ?? '2000', 10);
    this.delayMs = Number.isFinite(delay) && delay >= 0 ? delay : 2000;
    this.publicApiUrl =
      (config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:4000').replace(/\/+$/, '');
  }

  async createSession(_input: CreateSessionInput): Promise<CreateSessionResult> {
    const sessionId = randomUUID();
    const status: 'captured' | 'failed' = this.autoSucceed ? 'captured' : 'failed';
    this.scheduleWebhook(sessionId, status);
    return {
      sessionId,
      // Relative path the storefront knows how to handle. We don't return the full URL
      // because the storefront origin isn't necessarily known to the API.
      redirectUrl: `/checkout/processing?session=${sessionId}`,
    };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    // The signature is over the raw JSON body string the sender posted. We recompute
    // and timing-safe compare. Real providers (PhonePe) sign different payload schemes.
    const expected = this.sign(rawBody);
    if (signature.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i += 1) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('hex');
  }

  private scheduleWebhook(sessionId: string, status: 'captured' | 'failed'): void {
    const url = `${this.publicApiUrl}/api/v1/public/payments/webhook/mock`;
    const body = JSON.stringify({ sessionId, status });
    const signature = this.sign(body);
    setTimeout(() => {
      fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mock-signature': signature,
        },
        body,
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            this.logger.warn(
              `Mock webhook delivery failed: session=${sessionId} status=${res.status} body=${text.slice(0, 200)}`,
            );
          } else {
            this.logger.log(`Mock webhook delivered: session=${sessionId} status=${status}`);
          }
        })
        .catch((err) => {
          this.logger.error(
            `Mock webhook fetch threw: session=${sessionId} ${(err as Error).message}`,
          );
        });
    }, this.delayMs);
  }
}
