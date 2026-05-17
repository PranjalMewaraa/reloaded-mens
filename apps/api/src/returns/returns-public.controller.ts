import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  cancelReturnRequestSchema,
  createReturnRequestSchema,
  type CancelReturnRequest,
  type CreateReturnRequest,
} from '@repo/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ReturnsService } from './returns.service.js';

// Customer-facing return endpoints. No auth guard; each route verifies the per-order
// HMAC tracking token via TrackingTokenService inside the service.
@Controller('public/tracking')
export class ReturnsPublicController {
  constructor(private readonly returns: ReturnsService) {}

  @Get(':orderNumber/returnable')
  async eligibility(
    @Param('orderNumber') orderNumber: string,
    @Query('t') token: string,
  ) {
    return this.returns.getEligibility(orderNumber, token ?? '');
  }

  @Post(':orderNumber/return-photo')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPhoto(
    @Param('orderNumber') orderNumber: string,
    @Query('t') token: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file provided. Send field "file" as multipart.');
    return this.returns.uploadPhoto(orderNumber, token ?? '', file);
  }

  @Post(':orderNumber/return')
  @HttpCode(201)
  async create(
    @Param('orderNumber') orderNumber: string,
    @Query('t') token: string,
    @Body(new ZodValidationPipe(createReturnRequestSchema)) body: CreateReturnRequest,
  ) {
    return this.returns.createRequest(orderNumber, token ?? '', body);
  }

  @Get(':orderNumber/return/:returnNumber')
  async getSummary(
    @Param('orderNumber') orderNumber: string,
    @Param('returnNumber') returnNumber: string,
    @Query('t') token: string,
  ) {
    return this.returns.getCustomerSummary(orderNumber, returnNumber, token ?? '');
  }

  @Post(':orderNumber/return/:returnNumber/cancel')
  @HttpCode(200)
  async cancel(
    @Param('orderNumber') orderNumber: string,
    @Param('returnNumber') returnNumber: string,
    @Query('t') token: string,
    @Body(new ZodValidationPipe(cancelReturnRequestSchema)) body: CancelReturnRequest,
  ) {
    return this.returns.customerCancel(orderNumber, returnNumber, token ?? '', body);
  }
}
