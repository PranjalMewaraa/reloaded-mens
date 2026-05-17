import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@repo/db';
import type { AuditEventType } from '@repo/types';

export interface AuditContext {
  adminUserId?: string | null;
  resource?: string | null;
  payload?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // Synchronous write into AuditEvent. Cheap for auth volume.
  // Failures are logged but never thrown — auditing must not break the request path.
  async write(eventType: AuditEventType | string, ctx: AuditContext = {}): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          eventType,
          adminUserId: ctx.adminUserId ?? null,
          resource: ctx.resource ?? null,
          payload: (ctx.payload ?? null) as never,
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit event '${eventType}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
