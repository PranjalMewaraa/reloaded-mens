import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  AUDIT_EVENT_TYPE,
  LEAD_SOURCE,
  LEAD_STATUS,
  type AdminLeadListQuery,
  type CreateLeadRequest,
  type LeadListResponse,
  type LeadSummary,
  type UpdateLeadRequest,
} from '@repo/types';
import { AuditService } from '../audit/audit.service.js';

interface ActorCtx {
  adminUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class LeadsService {
  constructor(private readonly audit: AuditService) {}

  // -------- public ingestion --------

  async create(body: CreateLeadRequest, source: string, ctx: ActorCtx): Promise<LeadSummary> {
    const created = await prisma.lead.create({
      data: {
        source,
        status: LEAD_STATUS.NEW,
        name: body.name ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        message: body.message ?? null,
      },
    });
    await this.audit.write(AUDIT_EVENT_TYPE.LEAD_CREATED, {
      ...ctx,
      resource: `lead:${created.id}`,
      payload: { source, hasPhone: Boolean(body.phone), hasEmail: Boolean(body.email) },
    });
    return shape(created, null);
  }

  // -------- admin --------

  async list(query: AdminLeadListQuery): Promise<LeadListResponse> {
    const where: Prisma.LeadWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
        { message: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { assignedTo: { select: { name: true } } },
      }),
    ]);
    return {
      items: rows.map((r) => shape(r, r.assignedTo?.name ?? null)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getById(id: string): Promise<LeadSummary> {
    const row = await prisma.lead.findUnique({
      where: { id },
      include: { assignedTo: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException(`Lead ${id} not found`);
    return shape(row, row.assignedTo?.name ?? null);
  }

  async update(id: string, body: UpdateLeadRequest, ctx: ActorCtx): Promise<LeadSummary> {
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Lead ${id} not found`);

    const data: Prisma.LeadUpdateInput = {};
    const now = new Date();
    if (body.name !== undefined) data.name = body.name;
    if (body.internalNote !== undefined) data.internalNote = body.internalNote;
    if (body.assignedToId !== undefined) {
      data.assignedTo = body.assignedToId
        ? { connect: { id: body.assignedToId } }
        : { disconnect: true };
    }
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === LEAD_STATUS.CONTACTED && !existing.contactedAt) {
        data.contactedAt = now;
      } else if (body.status === LEAD_STATUS.CONVERTED && !existing.convertedAt) {
        data.convertedAt = now;
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data,
      include: { assignedTo: { select: { name: true } } },
    });
    await this.audit.write(AUDIT_EVENT_TYPE.LEAD_UPDATED, {
      ...ctx,
      resource: `lead:${id}`,
      payload: { fields: Object.keys(data) },
    });
    return shape(updated, updated.assignedTo?.name ?? null);
  }

  async remove(id: string, ctx: ActorCtx): Promise<{ ok: true }> {
    await prisma.lead.delete({ where: { id } });
    await this.audit.write(AUDIT_EVENT_TYPE.LEAD_DELETED, {
      ...ctx,
      resource: `lead:${id}`,
    });
    return { ok: true };
  }

  // Sprint 11 — Meta webhook will call this with source=META_LEAD_ADS + metaLeadId.
  async createFromMeta(/* future use */): Promise<LeadSummary> {
    throw new Error('createFromMeta lands in Sprint 11');
  }
}

// =====================================================
// Helpers
// =====================================================

type LeadRow = Prisma.LeadGetPayload<Record<string, never>>;

function shape(row: LeadRow, assignedToName: string | null): LeadSummary {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    internalNote: row.internalNote,
    assignedToId: row.assignedToId,
    assignedToName,
    contactedAt: row.contactedAt?.toISOString() ?? null,
    convertedAt: row.convertedAt?.toISOString() ?? null,
    convertedOrderId: row.convertedOrderId,
    createdAt: row.createdAt.toISOString(),
  };
}

// Keep LEAD_SOURCE re-exported so the controller can use it as a default arg.
export { LEAD_SOURCE };
