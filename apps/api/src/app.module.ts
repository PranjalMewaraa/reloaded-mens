import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'node:path';
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

@Module({
  imports: [
ConfigModule.forRoot({
  isGlobal: true,
  // In production (docker), env vars come from container env via docker-compose env_file.
  // In dev, load from repo-root .env.
  envFilePath: process.env.NODE_ENV === 'production' ? [] : ['../../.env', '.env'],
  ignoreEnvFile: process.env.NODE_ENV === 'production',
}),
    // Public file serving for LocalStorageProvider. Mounted at /files (outside the
    // /api/v1 global prefix — see main.ts setGlobalPrefix exclude).
    ServeStaticModule.forRoot({
      rootPath: resolve(process.cwd(), 'uploads'),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
