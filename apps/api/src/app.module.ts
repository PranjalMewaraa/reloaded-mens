import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { resolve } from 'node:path';
import { ExceptionsLoggerFilter } from './common/filters/exceptions-logger.filter.js';
import { HealthController } from './health/health.controller.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { VariantsModule } from './variants/variants.module.js';
import { PublicCatalogModule } from './public-catalog/public-catalog.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { EmailModule } from './email/email.module.js';
import { PublicCheckoutModule } from './public-checkout/public-checkout.module.js';
import { ShippingModule } from './shipping/shipping.module.js';
import { AdminOrdersModule } from './admin-orders/admin-orders.module.js';
import { RefundsModule } from './refunds/refunds.module.js';
import { PublicTrackingModule } from './public-tracking/public-tracking.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { CustomerAuthModule } from './customer-auth/customer-auth.module.js';
import { CustomerOrdersModule } from './customer-orders/customer-orders.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { AdminStaffModule } from './admin-staff/admin-staff.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [
ConfigModule.forRoot({
  isGlobal: true,
  // In production (docker), env vars come from container env via docker-compose env_file.
  // In dev, load from repo-root .env.
  envFilePath: process.env.NODE_ENV === 'production' ? [] : ['../../.env', '.env'],
  ignoreEnvFile: process.env.NODE_ENV === 'production',
}),

// Two named throttler tiers — the global default is generous so it doesn't
// trip up legitimate browsing, and a `strict` tier is opted into via
// @Throttle({ strict: ... }) on auth + OTP + coupon validation routes
// where abuse cost is high. Names must match the keys used in @Throttle.
ThrottlerModule.forRoot([
  { name: 'default', ttl: 60_000, limit: 120 }, // 120 req/min/IP — comfortable browsing
  { name: 'strict', ttl: 60_000, limit: 10 },   // 10 req/min/IP — auth, OTP, coupon checks
]),
    // Public file serving for LocalStorageProvider. Mounted at /files (outside the
    // /api/v1 global prefix — see main.ts setGlobalPrefix exclude).
    //
    // rootPath MUST match LocalStorageProvider's STORAGE_LOCAL_PATH so writes
    // and reads point to the same directory. In production the docker-compose
    // file mounts a named volume at /data/storage; STORAGE_LOCAL_PATH points
    // there, and uploads survive container recreates. In dev the env is
    // unset and we fall back to apps/api/uploads under cwd.
    ServeStaticModule.forRoot({
      rootPath: resolveStoragePath(),
      serveRoot: '/files',
      serveStaticOptions: { fallthrough: false, index: false },
    }),
    AuditModule,
    AuthModule,
    StorageModule,
    UploadsModule,
    CategoriesModule,
    ProductsModule,
    VariantsModule,
    PublicCatalogModule,
    PaymentsModule,
    EmailModule,
    ShippingModule,
    PublicTrackingModule,
    PublicCheckoutModule,
    AdminOrdersModule,
    RefundsModule,
    ReturnsModule,
    PromotionsModule,
    CustomerAuthModule,
    CustomerOrdersModule,
    LeadsModule,
    ReviewsModule,
    AdminStaffModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Apply ThrottlerGuard globally so every controller picks up the
    // "default" tier. Specific routes opt into the "strict" tier via
    // @Throttle({ strict: { ... } }) — see e.g. AuthController.login.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global exception filter — logs every caught exception with HTTP
    // context (method, url, status, ip, user) before delegating to
    // Nest's default response handler. Order, payment, and refund
    // failures show up in the api logs with enough context to debug
    // from the log line alone.
    { provide: APP_FILTER, useClass: ExceptionsLoggerFilter },
  ],
})
export class AppModule {}

// Mirrors the same logic in LocalStorageProvider — kept here as a top-level
// helper so ServeStaticModule.forRoot() can resolve the path synchronously
// without a ConfigService dependency (ServeStatic doesn't support
// forRootAsync in our version). Reads STORAGE_LOCAL_PATH directly from
// process.env, which docker-compose populates from env_file before Node
// starts. Falls back to <cwd>/uploads for local dev.
function resolveStoragePath(): string {
  const fromEnv = process.env.STORAGE_LOCAL_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : resolve(process.cwd(), 'uploads');
}
