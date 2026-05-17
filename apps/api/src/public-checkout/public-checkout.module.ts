import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { PublicTrackingModule } from '../public-tracking/public-tracking.module.js';
import { OrderNumberingService } from './order-numbering.service.js';
import { PricingService } from './pricing.service.js';
import { PublicCheckoutController } from './public-checkout.controller.js';
import { PublicCheckoutService } from './public-checkout.service.js';

@Module({
  // PublicTrackingModule exports TrackingTokenService — we use it here to stamp the
  // trackingToken on every new order at creation time so the success page + email
  // can render the same URL. Sprint 7's PromotionsModule provides the evaluator
  // used to re-price the cart inside the order tx.
  imports: [PaymentsModule, EmailModule, PublicTrackingModule, PromotionsModule],
  controllers: [PublicCheckoutController],
  providers: [OrderNumberingService, PricingService, PublicCheckoutService],
})
export class PublicCheckoutModule {}
