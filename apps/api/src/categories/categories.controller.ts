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
  ADMIN_ROLE,
  createCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type ReorderCategoriesInput,
  type UpdateCategoryInput,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CategoriesService } from './categories.service.js';

@Controller('categories')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // GET /categories?activeOnly=true — full nested tree.
  @Get()
  async list(@Query('activeOnly') activeOnly?: string) {
    const tree = await this.categories.getTree({ activeOnly: activeOnly === 'true' });
    return { items: tree };
  }

  // GET /categories/:id — single node (without children).
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.categories.getOne(id);
  }

  @Post()
  @HttpCode(201)
  async create(@Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput) {
    return this.categories.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.categories.softDelete(id);
  }

  @Post('reorder')
  @HttpCode(204)
  async reorder(
    @Body(new ZodValidationPipe(reorderCategoriesSchema)) body: ReorderCategoriesInput,
  ) {
    await this.categories.reorder(body);
  }
}
