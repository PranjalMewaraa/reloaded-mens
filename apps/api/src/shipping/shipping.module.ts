import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SHIPPING_PROVIDER } from '@repo/types';
import { MockShippingProvider } from './mock.shipping.provider.js';
import { ShiprocketShippingProvider } from './shiprocket.shipping.provider.js';
import { SHIPPING_PROVIDER_TOKEN, type ShippingProviderImpl } from './shipping.types.js';

// Factory keyed off SHIPPING_PROVIDER env (default 'mock'). Mirrors the
// PaymentsModule pattern.
@Module({
  imports: [ConfigModule],
  providers: [
    MockShippingProvider,
    ShiprocketShippingProvider,
    {
      provide: SHIPPING_PROVIDER_TOKEN,
      inject: [ConfigService, MockShippingProvider, ShiprocketShippingProvider],
      useFactory: (
        config: ConfigService,
        mock: MockShippingProvider,
        shiprocket: ShiprocketShippingProvider,
      ): ShippingProviderImpl => {
        const driver = (config.get<string>('SHIPPING_PROVIDER') ?? SHIPPING_PROVIDER.MOCK).toLowerCase();
        return driver === SHIPPING_PROVIDER.SHIPROCKET ? shiprocket : mock;
      },
    },
  ],
  exports: [SHIPPING_PROVIDER_TOKEN],
})
export class ShippingModule {}
