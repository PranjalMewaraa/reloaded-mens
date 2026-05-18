import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { UploadsController } from './uploads.controller.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
