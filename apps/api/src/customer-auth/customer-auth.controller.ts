import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  requestCustomerOtpSchema,
  updateCustomerProfileSchema,
  verifyCustomerOtpSchema,
  type RequestCustomerOtpRequest,
  type UpdateCustomerProfileRequest,
  type VerifyCustomerOtpRequest,
} from '@repo/types';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Customer, type AuthedCustomer } from './customer.decorator.js';
import { CUSTOMER_REFRESH_COOKIE, CustomerAuthService } from './customer-auth.service.js';
import { CustomerAuthGuard } from './customer-auth.guard.js';

function reqContext(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
  const userAgent = req.headers['user-agent'] ?? null;
  return { ipAddress: ip ?? null, userAgent };
}

@Controller('customer-auth')
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(
    @Body(new ZodValidationPipe(requestCustomerOtpSchema)) body: RequestCustomerOtpRequest,
    @Req() req: Request,
  ) {
    return this.auth.requestOtp(body.phone, reqContext(req));
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyCustomerOtpSchema)) body: VerifyCustomerOtpRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const customer = await this.auth.verifyOtp(body.phone, body.code, reqContext(req), res);
    return { customer };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[CUSTOMER_REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException();
    const customer = await this.auth.refreshSession(token, res);
    return { customer };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const accessToken = cookies?.['customer_access'];
    let customerId: string | null = null;
    if (accessToken) {
      try {
        const payload = this.auth.verifyAccess(accessToken);
        customerId = payload.sub;
      } catch {
        // ignore — clear cookies anyway
      }
    }
    await this.auth.logout(customerId, res, reqContext(req));
    return { ok: true };
  }

  @Get('me')
  @UseGuards(CustomerAuthGuard)
  async me(@Customer() customer: AuthedCustomer) {
    return { customer: await this.auth.getProfile(customer.id) };
  }

  @Patch('me')
  @UseGuards(CustomerAuthGuard)
  async updateMe(
    @Customer() customer: AuthedCustomer,
    @Body(new ZodValidationPipe(updateCustomerProfileSchema)) body: UpdateCustomerProfileRequest,
    @Req() req: Request,
  ) {
    return { customer: await this.auth.updateProfile(customer.id, body, reqContext(req)) };
  }
}
