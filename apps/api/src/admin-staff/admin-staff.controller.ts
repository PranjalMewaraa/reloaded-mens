import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_ROLE,
  createAdminStaffSchema,
  resetAdminStaffPasswordSchema,
  updateAdminStaffSchema,
  type CreateAdminStaffRequest,
  type ResetAdminStaffPasswordRequest,
  type UpdateAdminStaffRequest,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AdminStaffService } from './admin-staff.service.js';

// All endpoints are admin-only — staff users can't manage staff. The actor's
// id is forwarded into update/deactivate so the service can refuse self-
// lockout (admin demoting/deactivating themselves).

@Controller('admin-staff')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN)
export class AdminStaffController {
  constructor(private readonly staff: AdminStaffService) {}

  @Get()
  async list() {
    return this.staff.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.staff.get(id);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(createAdminStaffSchema)) body: CreateAdminStaffRequest,
  ) {
    return this.staff.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAdminStaffSchema)) body: UpdateAdminStaffRequest,
    @User() user: AuthedUser,
  ) {
    return this.staff.update(id, body, user.id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resetAdminStaffPasswordSchema))
    body: ResetAdminStaffPasswordRequest,
  ) {
    await this.staff.resetPassword(id, body.password);
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(200)
  async deactivate(@Param('id') id: string, @User() user: AuthedUser) {
    await this.staff.deactivate(id, user.id);
    return { ok: true };
  }
}
