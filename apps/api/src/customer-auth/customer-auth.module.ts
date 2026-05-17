import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../email/email.module.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthGuard } from './customer-auth.guard.js';
import { CustomerAuthService } from './customer-auth.service.js';

// Sprint 8 — customer auth (phone + email-OTP). CustomerAuthService is exported
// so the storefront /track route + customer-orders module can resolve the
// authenticated customer from the cookie.
@Module({
  imports: [ConfigModule, JwtModule.register({}), EmailModule],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerAuthGuard],
  exports: [CustomerAuthService, CustomerAuthGuard],
})
export class CustomerAuthModule {}
