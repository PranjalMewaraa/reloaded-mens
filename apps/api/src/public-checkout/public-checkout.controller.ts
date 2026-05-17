import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { createOrderRequestSchema, type CreateOrderRequest } from '@repo/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PublicCheckoutService } from './public-checkout.service.js';

// Public checkout endpoints. No auth guard — order URL entropy + idempotency key are
// the only access controls until Sprint 8 lands customer login. Sprint 7 retired the
// stand-alone /coupons/validate route — the storefront now calls /public/cart/evaluate
// (in PromotionsModule) which handles automatic promotions + coupon validation in one shot.
@Controller('public')
export class PublicCheckoutController {
  constructor(private readonly checkout: PublicCheckoutService) {}

  @Post('orders')
  @HttpCode(201)
  async createOrder(
    @Body(new ZodValidationPipe(createOrderRequestSchema)) body: CreateOrderRequest,
    @Headers('idempotency-key') headerKey: string | undefined,
  ) {
    if (headerKey && headerKey !== body.idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header must match body.idempotencyKey');
    }
    return this.checkout.createOrder(body);
  }

  @Get('orders/:orderNumber')
  async getOrder(@Param('orderNumber') orderNumber: string) {
    return this.checkout.getOrderByNumber(orderNumber);
  }

  @Post('payments/webhook/mock')
  @HttpCode(200)
  async mockWebhook(@Req() req: Request, @Headers('x-mock-signature') signature: string | undefined) {
    // We pull the raw body from req. main.ts wires express.json({ verify }) so the raw
    // bytes are preserved on req.rawBody for this route. Falls back to JSON.stringify of
    // the parsed body if the verifier wasn't reached (e.g. dev tooling).
    const raw = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ??
      JSON.stringify(req.body);
    return this.checkout.handleMockWebhook(raw, signature ?? '');
  }

  @Get('payments/sessions/:sessionId')
  async getPaymentStatus(@Param('sessionId') sessionId: string) {
    return this.checkout.getPaymentStatus(sessionId);
  }
}
