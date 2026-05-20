import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from '@repo/types';
import { MockPaymentProvider } from './mock.provider.js';
import { PhonePePaymentProvider } from './phonepe.provider.js';
import { RazorpayPaymentProvider } from './razorpay.provider.js';
import { PAYMENT_PROVIDER_TOKEN, type PaymentProviderImpl } from './payment.types.js';

// Factory keyed off PAYMENT_PROVIDER env. Default 'mock' keeps Sprint 4
// acceptance working out of the box. Sprint 10 lands Razorpay (with
// Route enabled) as the production driver — flip via env, no controller
// changes needed. PhonePe stays as a slotted alternative.
@Module({
  imports: [ConfigModule],
  providers: [
    MockPaymentProvider,
    RazorpayPaymentProvider,
    PhonePePaymentProvider,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, MockPaymentProvider, RazorpayPaymentProvider, PhonePePaymentProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
        razorpay: RazorpayPaymentProvider,
        phonepe: PhonePePaymentProvider,
      ): PaymentProviderImpl => {
        const driver = (config.get<string>('PAYMENT_PROVIDER') ?? PAYMENT_PROVIDER.MOCK).toLowerCase();
        if (driver === PAYMENT_PROVIDER.RAZORPAY) return razorpay;
        if (driver === PAYMENT_PROVIDER.PHONEPE) return phonepe;
        return mock;
      },
    },
  ],
  exports: [PAYMENT_PROVIDER_TOKEN],
})
export class PaymentsModule {}
