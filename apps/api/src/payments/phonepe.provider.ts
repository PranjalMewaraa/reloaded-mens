import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from '@repo/types';
import type {
  CreateSessionInput,
  CreateSessionResult,
  PaymentProviderImpl,
} from './payment.types.js';

// Placeholder for the real PhonePe integration (Sprint 10). The shape is here so the
// factory can wire it in, but every call throws — flipping PAYMENT_PROVIDER=phonepe today
// surfaces "set me up" errors loudly rather than half-working in production.
@Injectable()
export class PhonePePaymentProvider implements PaymentProviderImpl {
  readonly name = PAYMENT_PROVIDER.PHONEPE;

  constructor(config: ConfigService) {
    // Read env eagerly so misconfigured deploys explode at boot, not on first checkout.
    void config.get<string>('PHONEPE_MERCHANT_ID');
    void config.get<string>('PHONEPE_SALT_KEY');
    void config.get<string>('PHONEPE_SALT_INDEX');
  }

  createSession(_input: CreateSessionInput): Promise<CreateSessionResult> {
    return Promise.reject(
      new NotImplementedException(
        'PhonePe payment provider not configured. Set PAYMENT_PROVIDER=mock or wire the SDK + creds.',
      ),
    );
  }

  verifyWebhook(_rawBody: string, _signature: string): boolean {
    throw new NotImplementedException(
      'PhonePe webhook verification not implemented. Sprint 10 ships the X-VERIFY check.',
    );
  }
}
