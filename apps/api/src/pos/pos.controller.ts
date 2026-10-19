import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
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
import { AdminSettingsService } from '../admin-settings/admin-settings.service.js';

/**
 * POS endpoints for the billing.reloadedmens.in app.
 * All routes require Authorization: Bearer <BILLING_API_TOKEN>.
 */
@Controller('pos')
@UseGuards(PosAuthGuard)
export class PosController {
  constructor(
    private readonly pos: PosService,
    private readonly settings: AdminSettingsService,
  ) {}

  /** POS settings — UPI ID, display name, store info, all UPI slots */
  @Get('settings')
  async getSettings() {
    const [base, upi] = await Promise.all([
      this.pos.getSettings(),
      this.settings.getPosUpi(),
    ]);
    return { ...base, upiSlots: upi.slots, upiActiveIndex: upi.activeIndex };
  }

  /** Switch the active UPI slot (biller uses this live during billing) */
  @Post('upi/switch')
  @HttpCode(200)
  switchUpi(@Body('index', ParseIntPipe) index: number) {
    return this.settings.switchUpiActive(index);
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
