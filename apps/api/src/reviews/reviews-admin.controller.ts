import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ADMIN_ROLE,
  adminReviewListQuerySchema,
  rejectReviewSchema,
  type AdminReviewListQuery,
  type RejectReviewRequest,
} from '@repo/types';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ReviewsService } from './reviews.service.js';

function reqContext(req: Request, user: AuthedUser) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
  return {
    adminUserId: user.id,
    ipAddress: ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('admin-reviews')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class ReviewsAdminController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(adminReviewListQuerySchema)) query: AdminReviewListQuery) {
    return this.reviews.listAdmin(query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  async approve(@Param('id') id: string, @Req() req: Request, @User() user: AuthedUser) {
    return this.reviews.approve(id, reqContext(req, user));
  }

  @Post(':id/reject')
  @HttpCode(200)
  async reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectReviewSchema)) body: RejectReviewRequest,
    @Req() req: Request,
    @User() user: AuthedUser,
  ) {
    return this.reviews.reject(id, body.reason, reqContext(req, user));
  }
}
