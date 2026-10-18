import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createPosOrderSchema,
  posOrderListQuerySchema,
  type CreatePosOrderRequest,
  type PosOrderListQuery,
} from '@repo/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PosAuthGuard } from './pos-auth.guard.js';
import { PosService } from './pos.service.js';

/**
 * POS endpoints for the billing.reloadedmens.in app.
 * All routes require Authorization: Bearer <BILLING_API_TOKEN>.
 */
@Controller('pos')
@UseGuards(PosAuthGuard)
export class PosController {
  constructor(private readonly pos: PosService) {}

  /** POS settings — UPI ID, display name, store info */
  @Get('settings')
  getSettings() {
    return this.pos.getSettings();
  }

  /** Product search. q is the search term (empty = all). */
  @Get('products/search')
  searchProducts(@Query('q') q = '', @Query('page') page = '1') {
    return this.pos.searchProducts(q, parseInt(page, 10) || 1);
  }

  /** Create a POS order (single shot — payment already confirmed by biller). */
  @Post('orders')
  @HttpCode(201)
  createOrder(
    @Body(new ZodValidationPipe(createPosOrderSchema)) body: CreatePosOrderRequest,
  ) {
    return this.pos.createOrder(body);
  }

  /** List past POS orders with period filter. */
  @Get('orders')
  listOrders(
    @Query(new ZodValidationPipe(posOrderListQuerySchema)) query: PosOrderListQuery,
  ) {
    return this.pos.listOrders(query);
  }
}
