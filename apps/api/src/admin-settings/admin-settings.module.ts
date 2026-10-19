import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin-settings.controller.js';
import { AdminSettingsService } from './admin-settings.service.js';

@Module({
  controllers: [AdminSettingsController],
  providers: [AdminSettingsService],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
