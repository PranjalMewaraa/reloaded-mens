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
import {
  createOrderRequestSchema,
  razorpayVerifyRequestSchema,
  type CreateOrderRequest,
  type RazorpayVerifyRequest,
} from '@repo/types';
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

  // Razorpay Checkout modal calls back here with payment_id + order_id +
  // signature. We verify HMAC-SHA256 of `${order_id}|${payment_id}` against
  // RAZORPAY_KEY_SECRET. Successful verify transitions the order to confirmed.
  // The async webhook below arrives ~seconds later and is idempotent.
  @Post('payments/razorpay/verify')
  @HttpCode(200)
  async razorpayVerify(
    @Body(new ZodValidationPipe(razorpayVerifyRequestSchema)) body: RazorpayVerifyRequest,
  ) {
    return this.checkout.verifyRazorpayPayment(body);
  }

  // Razorpay's own webhook — fires async on every payment event. Backstop
  // for the modal-callback verify above (in case the customer closes the
  // tab before the modal can post the verify request). HMAC-SHA256 signature
  // over the raw body with RAZORPAY_WEBHOOK_SECRET.
  @Post('payments/webhook/razorpay')
  @HttpCode(200)
  async razorpayWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    const raw =
      (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ??
      JSON.stringify(req.body);
    return this.checkout.handleRazorpayWebhook(raw, signature ?? '');
  }

  @Get('payments/sessions/:sessionId')
  async getPaymentStatus(@Param('sessionId') sessionId: string) {
    return this.checkout.getPaymentStatus(sessionId);
  }
}
