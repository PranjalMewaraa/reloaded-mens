import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PublicTrackingController } from './public-tracking.controller.js';
import { PublicTrackingService } from './public-tracking.service.js';
import { TrackingTokenService } from './tracking-token.service.js';

// Exports TrackingTokenService so PublicCheckoutModule can reuse the same signer
// when stamping new orders. Keeps the secret in one module.
@Module({
  imports: [ConfigModule],
  controllers: [PublicTrackingController],
  providers: [PublicTrackingService, TrackingTokenService],
  exports: [TrackingTokenService],
})
export class PublicTrackingModule {}
