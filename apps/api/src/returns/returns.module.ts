import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PublicTrackingModule } from '../public-tracking/public-tracking.module.js';
import { RefundsModule } from '../refunds/refunds.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { OrderNumberingService } from '../public-checkout/order-numbering.service.js';
import { ReturnsAdminController } from './returns-admin.controller.js';
import { ReturnsPublicController } from './returns-public.controller.js';
import { ReturnsService } from './returns.service.js';

// Returns sit at the intersection of orders + refunds + tracking. RefundsModule now
// exports RefundsService so ReturnsService can call create() on verified returns
// without a duplicate provider registration.
@Module({
  imports: [AuthModule, PublicTrackingModule, StorageModule, RefundsModule],
  controllers: [ReturnsPublicController, ReturnsAdminController],
  providers: [ReturnsService, OrderNumberingService],
})
export class ReturnsModule {}
