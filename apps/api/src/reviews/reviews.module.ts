import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { ReviewTokenService } from './review-token.service.js';
import { ReviewsAdminController } from './reviews-admin.controller.js';
import { ReviewsPublicController } from './reviews-public.controller.js';
import { ReviewsService } from './reviews.service.js';

// ReviewsService is exported so PublicCatalogService can join aggregates onto
// product list + detail responses without a second round trip.
@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [ReviewsAdminController, ReviewsPublicController],
  providers: [ReviewsService, ReviewTokenService],
  exports: [ReviewsService, ReviewTokenService],
})
export class ReviewsModule {}
