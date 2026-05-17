import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ADMIN_ROLE,
  adminOrderListQuerySchema,
  cancelOrderRequestSchema,
  transitionOrderRequestSchema,
  updateInternalNoteSchema,
  type AdminOrderListQuery,
  type CancelOrderRequest,
  type TransitionOrderRequest,
  type UpdateInternalNoteRequest,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Controller('orders')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(adminOrderListQuerySchema)) query: AdminOrderListQuery) {
    return this.orders.list(query);
  }

  @Get(':id')
  async getDetail(@Param('id') id: string) {
    return this.orders.getDetail(id);
  }

  @Post(':id/transition')
  async transition(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transitionOrderRequestSchema)) body: TransitionOrderRequest,
    @User() user: AuthedUser,
  ) {
    return this.orders.transition(id, body, { id: user.id, role: user.role });
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelOrderRequestSchema)) body: CancelOrderRequest,
    @User() user: AuthedUser,
  ) {
    return this.orders.cancel(id, body, { id: user.id, role: user.role });
  }

  @Patch(':id/note')
  async updateNote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInternalNoteSchema)) body: UpdateInternalNoteRequest,
    @User() user: AuthedUser,
  ) {
    return this.orders.updateNote(id, body.note, { id: user.id, role: user.role });
  }

  // Returns text/html so the admin can hit Ctrl+P and save to PDF. We set
  // Content-Disposition: inline (default for HTML) so the browser renders rather than
  // downloads — better UX since the print dialog handles the actual save.
  @Get(':id/label')
  @HttpCode(200)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async label(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const html = await this.orders.renderLabel(id);
    res.send(html);
  }
}
