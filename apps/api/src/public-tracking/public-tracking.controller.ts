import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import {
  customerCancelRequestSchema,
  type CustomerCancelRequest,
} from '@repo/types';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  CUSTOMER_ACCESS_COOKIE,
  CustomerAuthService,
} from '../customer-auth/customer-auth.service.js';
import { PublicTrackingService } from './public-tracking.service.js';

@Controller('public/tracking')
export class PublicTrackingController {
  constructor(
    private readonly tracking: PublicTrackingService,
    private readonly customerAuth: CustomerAuthService,
  ) {}

  // GET /public/tracking/:orderNumber?t=<token>
  // Sprint 8 — also accepts the customer_access cookie. If a logged-in customer
  // owns the order, the t= query param is optional. Otherwise we fall back to
  // the per-order tracking token check.
  @Get(':orderNumber')
  async get(
    @Param('orderNumber') orderNumber: string,
    @Query('t') token: string,
    @Req() req: Request,
  ) {
    const customerId = this.tryReadCustomerId(req);
    return this.tracking.getTracking(orderNumber, token ?? '', customerId);
  }

  // POST /public/tracking/:orderNumber/cancel?t=<token>
  @Post(':orderNumber/cancel')
  @HttpCode(200)
  async cancel(
    @Param('orderNumber') orderNumber: string,
    @Query('t') token: string,
    @Body(new ZodValidationPipe(customerCancelRequestSchema)) body: CustomerCancelRequest,
  ) {
    return this.tracking.customerCancel(orderNumber, token ?? '', body);
  }

  private tryReadCustomerId(req: Request): string | null {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[CUSTOMER_ACCESS_COOKIE];
    if (!token) return null;
    try {
      const payload = this.customerAuth.verifyAccess(token);
      return payload.type === 'customer_access' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
