import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_ROLE,
  adminLeadListQuerySchema,
  updateLeadSchema,
  type AdminLeadListQuery,
  type UpdateLeadRequest,
} from '@repo/types';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { LeadsService } from './leads.service.js';

function reqContext(req: Request, user: AuthedUser) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
  return {
    adminUserId: user.id,
    ipAddress: ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('admin-leads')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class LeadsAdminController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(adminLeadListQuerySchema)) query: AdminLeadListQuery) {
    return this.leads.list(query);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.leads.getById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLeadSchema)) body: UpdateLeadRequest,
    @Req() req: Request,
    @User() user: AuthedUser,
  ) {
    return this.leads.update(id, body, reqContext(req, user));
  }

  @Delete(':id')
  @Roles(ADMIN_ROLE.ADMIN)
  async remove(@Param('id') id: string, @Req() req: Request, @User() user: AuthedUser) {
    return this.leads.remove(id, reqContext(req, user));
  }
}
