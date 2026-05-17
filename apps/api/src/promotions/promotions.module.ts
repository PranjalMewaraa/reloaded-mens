import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CartEvaluateController } from './cart-evaluate.controller.js';
import { PromotionsAdminController } from './promotions-admin.controller.js';
import { PromotionsService } from './promotions.service.js';

// Sprint 7 — Promotions + coupons + cart-evaluate. PromotionsService is exported
// so PublicCheckoutModule can call evaluate() + commitForOrder() from inside its
// order-create transaction. AuditModule is @Global so no explicit import needed.
@Module({
  imports: [AuthModule],
  controllers: [PromotionsAdminController, CartEvaluateController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
