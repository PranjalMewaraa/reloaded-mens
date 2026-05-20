import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ADMIN_ROLE,
  STAFF_MODULE,
  createRefundRequestSchema,
  refundListQuerySchema,
  rejectRefundSchema,
  type CreateRefundRequest,
  type RefundListQuery,
  type RejectRefundRequest,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { ModuleGuard } from '../auth/guards/module.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { RequireModule } from '../auth/decorators/require-module.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RefundsService } from './refunds.service.js';

@Controller('refunds')
@UseGuards(JwtAccessGuard, RolesGuard, ModuleGuard)
@RequireModule(STAFF_MODULE.REFUNDS)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  // Staff or admin can file a refund request.
  @Post()
  @HttpCode(201)
  @Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
  async create(
    @Body(new ZodValidationPipe(createRefundRequestSchema)) body: CreateRefundRequest,
    @User() user: AuthedUser,
  ) {
    return this.refunds.create(body, { id: user.id, role: user.role });
  }

  // Admin queue. Staff can view too — it's useful for them to see request status.
  @Get()
  @Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
  async list(@Query(new ZodValidationPipe(refundListQuerySchema)) query: RefundListQuery) {
    return this.refunds.list(query);
  }

  // Approve + Reject — admin only. The mock payment refund happens in the same tx.
  @Post(':id/approve')
  @HttpCode(200)
  @Roles(ADMIN_ROLE.ADMIN)
  async approve(@Param('id') id: string, @User() user: AuthedUser) {
    return this.refunds.approve(id, { id: user.id });
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles(ADMIN_ROLE.ADMIN)
  async reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectRefundSchema)) body: RejectRefundRequest,
    @User() user: AuthedUser,
  ) {
    return this.refunds.reject(id, body.reason, { id: user.id });
  }
}
