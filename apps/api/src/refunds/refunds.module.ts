import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrderNumberingService } from '../public-checkout/order-numbering.service.js';
import { RefundsController } from './refunds.controller.js';
import { RefundsService } from './refunds.service.js';

// We re-use OrderNumberingService (lives in public-checkout) to generate RFD- numbers
// off a separate Settings counter. Registered locally here so RefundsModule doesn't
// have to take a hard dependency on PublicCheckoutModule.
@Module({
  imports: [AuthModule],
  controllers: [RefundsController],
  providers: [RefundsService, OrderNumberingService],
  // Sprint 6 — ReturnsService consumes RefundsService when verification triggers a
  // pending refund. Export so the consumer module doesn't need to register a duplicate.
  exports: [RefundsService],
})
export class RefundsModule {}
