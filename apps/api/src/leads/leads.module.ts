import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LeadsAdminController } from './leads-admin.controller.js';
import { LeadsPublicController } from './leads-public.controller.js';
import { LeadsService } from './leads.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LeadsAdminController, LeadsPublicController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
