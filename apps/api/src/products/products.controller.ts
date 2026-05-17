import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_ROLE,
  createProductSchema,
  productListQuerySchema,
  setProductCategoriesSchema,
  updateProductSchema,
  type CreateProductInput,
  type ProductListQuery,
  type SetProductCategoriesInput,
  type UpdateProductInput,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery) {
    return this.products.list(query);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.products.getOne(id);
  }

  @Post()
  @HttpCode(201)
  async create(@Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput) {
    return this.products.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ) {
    return this.products.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.products.softDelete(id);
  }

  // PUT /products/:id/categories — replaces the full set of assignments in one shot.
  @Put(':id/categories')
  async setCategories(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setProductCategoriesSchema)) body: SetProductCategoriesInput,
  ) {
    return this.products.setCategories(id, body);
  }
}
