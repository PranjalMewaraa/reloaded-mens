import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { AdminSettingsService } from './admin-settings.service.js';

@Controller('admin/settings')
@UseGuards(JwtAccessGuard)
export class AdminSettingsController {
  constructor(private readonly svc: AdminSettingsService) {}

  @Get('pos-upi')
  getPosUpi() {
    return this.svc.getPosUpi();
  }

  @Patch('pos-upi')
  updatePosUpi(@Body() body: unknown) {
    return this.svc.updatePosUpi(body);
  }
}
