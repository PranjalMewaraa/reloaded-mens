import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  productReviewsQuerySchema,
  submitReviewSchema,
  type ProductReviewsQuery,
  type SubmitReviewRequest,
} from '@repo/types';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ReviewsService } from './reviews.service.js';

function reqContext(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
  return { ipAddress: ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}

@Controller('public')
export class ReviewsPublicController {
  constructor(private readonly reviews: ReviewsService) {}

  // PDP listing — paginated, only approved.
  @Get('products/:slug/reviews')
  async listForProduct(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(productReviewsQuerySchema)) query: ProductReviewsQuery,
  ) {
    return this.reviews.getProductReviews(slug, query);
  }

  // Pre-fill the submission form. Token in the query string. Bad token → 401.
  @Get('reviews/submit')
  async prompt(
    @Query('orderItemId') orderItemId: string | undefined,
    @Query('t') token: string | undefined,
  ) {
    if (!orderItemId || !token) {
      throw new BadRequestException('orderItemId and t are required');
    }
    return this.reviews.getSubmissionPrompt(orderItemId, token);
  }

  // Submit. Idempotent — returns the existing record on repeat posts.
  @Post('reviews/submit')
  @HttpCode(200)
  async submit(
    @Query('orderItemId') orderItemId: string | undefined,
    @Query('t') token: string | undefined,
    @Body(new ZodValidationPipe(submitReviewSchema)) body: SubmitReviewRequest,
    @Req() req: Request,
  ) {
    if (!orderItemId || !token) {
      throw new BadRequestException('orderItemId and t are required');
    }
    return this.reviews.submitReview(orderItemId, token, body, reqContext(req));
  }
}
