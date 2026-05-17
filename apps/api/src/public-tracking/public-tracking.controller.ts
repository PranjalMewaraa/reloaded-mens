import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  customerCancelRequestSchema,
  type CustomerCancelRequest,
} from '@repo/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PublicTrackingService } from './public-tracking.service.js';

@Controller('public/tracking')
export class PublicTrackingController {
  constructor(private readonly tracking: PublicTrackingService) {}

  // GET /public/tracking/:orderNumber?t=<token>
  // Token check happens inside the service so we can return a uniform 401 regardless
  // of whether the order exists (small reduction in oracle surface).
  @Get(':orderNumber')
  async get(@Param('orderNumber') orderNumber: string, @Query('t') token: string) {
    return this.tracking.getTracking(orderNumber, token ?? '');
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
}
