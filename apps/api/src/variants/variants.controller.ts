import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ACTOR,
  ADMIN_ROLE,
  STAFF_MODULE,
  createVariantSchema,
  inventoryListQuerySchema,
  matrixCreateSchema,
  stockAdjustSchema,
  updateVariantSchema,
  type CreateVariantInput,
  type InventoryListQuery,
  type MatrixCreateInput,
  type StockAdjustInput,
  type UpdateVariantInput,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { ModuleGuard } from '../auth/guards/module.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { RequireModule } from '../auth/decorators/require-module.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { VariantsService } from './variants.service.js';

// Variants live under /products/:productId/variants for create/list (their natural parent)
// and under /variants/:id for everything that needs a stable URL.
@Controller()
@UseGuards(JwtAccessGuard, RolesGuard, ModuleGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
@RequireModule(STAFF_MODULE.INVENTORY)
export class VariantsController {
  constructor(private readonly variants: VariantsService) {}

  @Get('products/:productId/variants')
  async listForProduct(@Param('productId') productId: string) {
    const items = await this.variants.listForProduct(productId);
    return { items };
  }

  @Post('products/:productId/variants')
  @HttpCode(201)
  async create(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(createVariantSchema)) body: CreateVariantInput,
  ) {
    return this.variants.create(productId, body);
  }

  @Post('products/:productId/variants/matrix')
  @HttpCode(201)
  async createMatrix(
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(matrixCreateSchema)) body: MatrixCreateInput,
  ) {
    const items = await this.variants.createMatrix(productId, body);
    return { items };
  }

  @Patch('variants/:id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVariantSchema)) body: UpdateVariantInput,
  ) {
    return this.variants.update(id, body);
  }

  @Delete('variants/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.variants.softDelete(id);
  }

  // POST /variants/:id/stock-adjust — the acceptance-gate write. Always logs an
  // InventoryEvent with the admin actor recorded.
  @Post('variants/:id/stock-adjust')
  async adjustStock(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(stockAdjustSchema)) body: StockAdjustInput,
    @User() user: AuthedUser,
  ) {
    return this.variants.adjustStock(id, body, {
      actor: ACTOR.ADMIN,
      actorId: user.id,
    });
  }

  @Get('variants/:id/inventory-events')
  async events(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    const items = await this.variants.getEvents(id, Number.isFinite(parsed) ? parsed : 50);
    return { items };
  }

  // GET /variants?page&limit&q&lowStockOnly — feeds the /inventory page.
  @Get('variants')
  async listInventory(
    @Query(new ZodValidationPipe(inventoryListQuerySchema)) query: InventoryListQuery,
  ) {
    return this.variants.listInventory(query);
  }
}
