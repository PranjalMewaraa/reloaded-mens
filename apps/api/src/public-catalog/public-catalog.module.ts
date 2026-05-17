import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { PublicCatalogController } from './public-catalog.controller.js';
import { PublicCatalogService } from './public-catalog.service.js';

@Module({
  imports: [ReviewsModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicCatalogModule {}
