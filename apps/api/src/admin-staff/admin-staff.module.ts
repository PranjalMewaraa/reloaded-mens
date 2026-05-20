import { Module } from '@nestjs/common';
import { AdminStaffController } from './admin-staff.controller.js';
import { AdminStaffService } from './admin-staff.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminStaffController],
  providers: [AdminStaffService],
})
export class AdminStaffModule {}
