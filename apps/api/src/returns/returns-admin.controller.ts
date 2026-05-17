import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_ROLE,
  adminReturnListQuerySchema,
  approveReturnSchema,
  cancelReturnRequestSchema,
  markReceivedSchema,
  rejectReturnSchema,
  updateReturnNoteSchema,
  verifyReturnRequestSchema,
  type AdminReturnListQuery,
  type ApproveReturnRequest,
  type CancelReturnRequest,
  type MarkReceivedRequest,
  type RejectReturnRequest,
  type UpdateReturnNoteRequest,
  type VerifyReturnPayload,
} from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ReturnsService } from './returns.service.js';

@Controller('admin-returns')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class ReturnsAdminController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(adminReturnListQuerySchema)) query: AdminReturnListQuery,
  ) {
    return this.returns.list(query);
  }

  @Get(':id')
  async getDetail(@Param('id') id: string) {
    return this.returns.getDetail(id);
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveReturnSchema)) body: ApproveReturnRequest,
    @User() user: AuthedUser,
  ) {
    return this.returns.approve(id, body, { id: user.id, role: user.role });
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectReturnSchema)) body: RejectReturnRequest,
    @User() user: AuthedUser,
  ) {
    return this.returns.reject(id, body, { id: user.id, role: user.role });
  }

  @Post(':id/mark-received')
  async markReceived(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markReceivedSchema)) body: MarkReceivedRequest,
    @User() user: AuthedUser,
  ) {
    return this.returns.markReceived(id, body, { id: user.id, role: user.role });
  }

  @Post(':id/verify')
  async verify(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(verifyReturnRequestSchema)) body: VerifyReturnPayload,
    @User() user: AuthedUser,
  ) {
    return this.returns.verify(id, body, { id: user.id, role: user.role });
  }

  @Post(':id/mark-completed')
  async markCompleted(@Param('id') id: string, @User() user: AuthedUser) {
    return this.returns.markCompleted(id, { id: user.id, role: user.role });
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelReturnRequestSchema)) body: CancelReturnRequest,
    @User() user: AuthedUser,
  ) {
    return this.returns.adminCancel(id, body.reason ?? 'Cancelled by admin', {
      id: user.id,
      role: user.role,
    });
  }

  @Patch(':id/note')
  async note(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateReturnNoteSchema)) body: UpdateReturnNoteRequest,
    @User() user: AuthedUser,
  ) {
    return this.returns.updateInternalNote(id, body.note, { id: user.id, role: user.role });
  }
}
