import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from '@repo/types';
import { MockPaymentProvider } from './mock.provider.js';
import { PhonePePaymentProvider } from './phonepe.provider.js';
import { PAYMENT_PROVIDER_TOKEN, type PaymentProviderImpl } from './payment.types.js';

// Factory keyed off PAYMENT_PROVIDER env. Default 'mock' keeps Sprint 4 acceptance
// working out of the box. Flip to 'phonepe' (Sprint 10+) to swap targets without
// touching any controller.
@Module({
  imports: [ConfigModule],
  providers: [
    MockPaymentProvider,
    PhonePePaymentProvider,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, MockPaymentProvider, PhonePePaymentProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
        phonepe: PhonePePaymentProvider,
      ): PaymentProviderImpl => {
        const driver = (config.get<string>('PAYMENT_PROVIDER') ?? PAYMENT_PROVIDER.MOCK).toLowerCase();
        return driver === PAYMENT_PROVIDER.PHONEPE ? phonepe : mock;
      },
    },
  ],
  exports: [PAYMENT_PROVIDER_TOKEN],
})
export class PaymentsModule {}
