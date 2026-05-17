import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  publicProductListQuerySchema,
  serviceabilityQuerySchema,
  type PublicProductListQuery,
  type ServiceabilityQuery,
} from '@repo/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PublicCatalogService } from './public-catalog.service.js';

// Public endpoints — no JwtAccessGuard. Mounted under /public to keep them distinct
// from the admin-guarded routes at /products, /categories, /variants.
@Controller('public')
export class PublicCatalogController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get('products')
  async listProducts(
    @Query(new ZodValidationPipe(publicProductListQuerySchema))
    query: PublicProductListQuery,
  ) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    const product = await this.catalog.getProductBySlug(slug);
    const related = await this.catalog.getRelated(product.id, 8);
    return { product, related };
  }

  @Get('categories')
  async listCategoryTree() {
    return this.catalog.listCategoryTree();
  }

  @Get('categories/:slug')
  async getCategoryBySlug(@Param('slug') slug: string) {
    return this.catalog.getCategoryBySlug(slug);
  }

  @Get('serviceability')
  async checkServiceability(
    @Query(new ZodValidationPipe(serviceabilityQuerySchema)) query: ServiceabilityQuery,
  ) {
    return this.catalog.checkServiceability(query.pincode);
  }
}
