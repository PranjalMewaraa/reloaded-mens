import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { cartEvaluateRequestSchema, type CartEvaluateRequest } from '@repo/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PromotionsService } from './promotions.service.js';

// Public, unauthenticated. The cart sheet + checkout summary call this on every
// change to surface live discount lines + free-shipping state. Order placement
// re-runs evaluate server-side so the math is canonical.
@Controller('public/cart')
export class CartEvaluateController {
  constructor(private readonly promotions: PromotionsService) {}

  @Post('evaluate')
  @HttpCode(200)
  async evaluate(
    @Body(new ZodValidationPipe(cartEvaluateRequestSchema)) body: CartEvaluateRequest,
  ) {
    return this.promotions.evaluate(body);
  }
}
