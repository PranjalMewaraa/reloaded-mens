import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_ROLE,
  STAFF_MODULE,
  couponListQuerySchema,
  createPromotionSchema,
  generateCouponsSchema,
  promotionListQuerySchema,
  singleCouponCreateSchema,
  updatePromotionSchema,
  type CouponListQuery,
  type CreatePromotionRequest,
  type GenerateCouponsRequest,
  type PromotionListQuery,
  type SingleCouponCreate,
  type UpdatePromotionRequest,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { ModuleGuard } from '../auth/guards/module.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { RequireModule } from '../auth/decorators/require-module.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PromotionsService } from './promotions.service.js';

// Admin promotions API. Mutation routes restrict to ADMIN; reads allow STAFF.
@Controller('admin-promotions')
@UseGuards(JwtAccessGuard, RolesGuard, ModuleGuard)
@RequireModule(STAFF_MODULE.PROMOTIONS)
export class PromotionsAdminController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
  async list(@Query(new ZodValidationPipe(promotionListQuerySchema)) query: PromotionListQuery) {
    return this.promotions.list(query);
  }

  @Get(':id')
  @Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
  async detail(@Param('id') id: string) {
    return this.promotions.getById(id);
  }

  @Post()
  @Roles(ADMIN_ROLE.ADMIN)
  async create(
    @Body(new ZodValidationPipe(createPromotionSchema)) body: CreatePromotionRequest,
    @User() user: AuthedUser,
  ) {
    return this.promotions.create(body, { id: user.id });
  }

  @Patch(':id')
  @Roles(ADMIN_ROLE.ADMIN)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePromotionSchema)) body: UpdatePromotionRequest,
    @User() user: AuthedUser,
  ) {
    return this.promotions.update(id, body, { id: user.id });
  }

  @Delete(':id')
  @Roles(ADMIN_ROLE.ADMIN)
  async remove(@Param('id') id: string, @User() user: AuthedUser) {
    return this.promotions.delete(id, { id: user.id });
  }

  // ---------------- Coupons ----------------

  @Get(':id/coupons')
  @Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
  async listCoupons(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(couponListQuerySchema)) query: CouponListQuery,
  ) {
    return this.promotions.listCoupons(id, { page: query.page, limit: query.limit, batch: query.batch });
  }

  @Post(':id/coupons')
  @Roles(ADMIN_ROLE.ADMIN)
  async createCoupon(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(singleCouponCreateSchema)) body: SingleCouponCreate,
    @User() user: AuthedUser,
  ) {
    return this.promotions.createCoupon(id, body, { id: user.id });
  }

  @Post(':id/coupons/bulk')
  @Roles(ADMIN_ROLE.ADMIN)
  @HttpCode(200)
  async bulkGenerate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generateCouponsSchema)) body: GenerateCouponsRequest,
    @User() user: AuthedUser,
  ) {
    return this.promotions.generateCoupons(id, body, { id: user.id });
  }

  @Post('coupons/:couponId/deactivate')
  @Roles(ADMIN_ROLE.ADMIN)
  @HttpCode(200)
  async deactivateCoupon(@Param('couponId') couponId: string, @User() user: AuthedUser) {
    return this.promotions.deactivateCoupon(couponId, { id: user.id });
  }
}
