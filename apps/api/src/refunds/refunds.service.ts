import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  ACTOR,
  ADMIN_ROLE,
  AUDIT_EVENT_TYPE,
  ORDER_EVENT_TYPE,
  ORDER_STATE,
  PAYMENT_PROVIDER,
  PAYMENT_STATE,
  REFUND_STATUS,
  type CreateRefundRequest,
  type RefundListQuery,
} from '@repo/types';
import { AuditService } from '../audit/audit.service.js';
import { OrderNumberingService } from '../public-checkout/order-numbering.service.js';

// Refund workflow:
//  staff/admin POST /refunds (status=pending_admin_approval)
//  → admin POST /refunds/:id/approve (status=approved + Payment.refunded + Order.refunded)
//  → mock provider's "refund" is just flipping Payment.status to 'refunded';
//    Sprint 10 will swap in PhonePe's actual refund API.

@Injectable()
export class RefundsService {
  constructor(
    private readonly audit: AuditService,
    private readonly numbering: OrderNumberingService,
  ) {}

  // -------- POST /refunds --------

  async create(body: CreateRefundRequest, requestedBy: { id: string; role: string }) {
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      select: {
        id: true,
        orderNumber: true,
        state: true,
        paymentState: true,
        totalPaisa: true,
        deletedAt: true,
      },
    });
    if (!order || order.deletedAt) {
      throw new NotFoundException(`Order ${body.orderId} not found`);
    }
    if (order.paymentState !== PAYMENT_STATE.PAID) {
      throw new BadRequestException(
        `Order is in payment state "${order.paymentState}" — only paid orders can be refunded`,
      );
    }
    if (body.amountPaisa !== order.totalPaisa) {
      throw new BadRequestException(
        `Partial refunds aren't supported yet. Pass amountPaisa=${order.totalPaisa}.`,
      );
    }
    // Block stacking unresolved refunds — caller can re-request after a rejection.
    const existing = await prisma.refundRequest.findFirst({
      where: {
        orderId: order.id,
        status: { in: [REFUND_STATUS.PENDING_ADMIN_APPROVAL, REFUND_STATUS.APPROVED] },
      },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: `An open refund (${existing.refundNumber}) already exists for this order`,
      });
    }

    const refund = await prisma.$transaction(async (tx) => {
      const refundNumber = await this.numbering.next(tx, 'refund');
      const created = await tx.refundRequest.create({
        data: {
          refundNumber,
          orderId: order.id,
          status: REFUND_STATUS.PENDING_ADMIN_APPROVAL,
          amountPaisa: body.amountPaisa,
          reason: body.reason,
          requestedBy: requestedBy.id,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: ORDER_EVENT_TYPE.REFUND_REQUESTED,
          actor: requestedBy.role === ADMIN_ROLE.ADMIN ? ACTOR.ADMIN : ACTOR.STAFF,
          actorId: requestedBy.id,
          message: `Refund requested · ${body.reason}`,
          payload: { refundId: created.id, amountPaisa: body.amountPaisa },
        },
      });
      return created;
    });

    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_REFUND_REQUESTED, {
      adminUserId: requestedBy.id,
      resource: `order:${order.orderNumber}`,
      payload: { refundNumber: refund.refundNumber, amountPaisa: body.amountPaisa, reason: body.reason },
    });

    return refund;
  }

  // -------- GET /refunds --------

  async list(query: RefundListQuery) {
    const where: Prisma.RefundRequestWhereInput = {};
    if (query.status) where.status = query.status;
    const [total, items] = await Promise.all([
      prisma.refundRequest.count({ where }),
      prisma.refundRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { order: { select: { orderNumber: true, totalPaisa: true } } },
      }),
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        refundNumber: r.refundNumber,
        orderId: r.orderId,
        orderNumber: r.order.orderNumber,
        status: r.status,
        amountPaisa: r.amountPaisa,
        reason: r.reason,
        rejectedReason: r.rejectedReason,
        requestedBy: r.requestedBy,
        approvedBy: r.approvedBy,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  // -------- POST /refunds/:id/approve --------

  async approve(refundId: string, admin: { id: string }) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refundRequest.findUnique({
        where: { id: refundId },
        include: { order: { include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      });
      if (!refund) throw new NotFoundException(`Refund ${refundId} not found`);
      if (refund.status !== REFUND_STATUS.PENDING_ADMIN_APPROVAL) {
        throw new ConflictException({
          statusCode: 409,
          message: `Refund is in "${refund.status}" — already decided`,
        });
      }

      const now = new Date();
      const payment = refund.order.payments[0] ?? null;

      const updated = await tx.refundRequest.update({
        where: { id: refundId },
        data: {
          status: REFUND_STATUS.APPROVED,
          approvedBy: admin.id,
          completedAt: now,
          provider: payment?.provider ?? PAYMENT_PROVIDER.MOCK,
        },
      });
      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded' },
        });
      }
      await tx.order.update({
        where: { id: refund.orderId },
        data: {
          state: ORDER_STATE.REFUNDED,
          paymentState: PAYMENT_STATE.REFUNDED,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: refund.orderId,
          eventType: ORDER_EVENT_TYPE.PAYMENT_REFUNDED,
          actor: ACTOR.ADMIN,
          actorId: admin.id,
          message: `Refund ${refund.refundNumber} approved`,
          payload: { refundNumber: refund.refundNumber },
        },
      });
      await this.audit.write(AUDIT_EVENT_TYPE.ORDER_REFUND_APPROVED, {
        adminUserId: admin.id,
        resource: `order:${refund.order.orderNumber}`,
        payload: { refundNumber: refund.refundNumber, amountPaisa: refund.amountPaisa },
      });
      return updated;
    });
  }

  // -------- POST /refunds/:id/reject --------

  async reject(refundId: string, reason: string, admin: { id: string }) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refundRequest.findUnique({
        where: { id: refundId },
        include: { order: { select: { orderNumber: true } } },
      });
      if (!refund) throw new NotFoundException(`Refund ${refundId} not found`);
      if (refund.status !== REFUND_STATUS.PENDING_ADMIN_APPROVAL) {
        throw new ConflictException({
          statusCode: 409,
          message: `Refund is in "${refund.status}" — already decided`,
        });
      }
      const updated = await tx.refundRequest.update({
        where: { id: refundId },
        data: {
          status: REFUND_STATUS.REJECTED,
          approvedBy: admin.id,
          rejectedReason: reason,
          completedAt: new Date(),
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: refund.orderId,
          eventType: ORDER_EVENT_TYPE.REFUND_REJECTED,
          actor: ACTOR.ADMIN,
          actorId: admin.id,
          message: `Refund ${refund.refundNumber} rejected · ${reason}`,
          payload: { refundNumber: refund.refundNumber, reason },
        },
      });
      await this.audit.write(AUDIT_EVENT_TYPE.ORDER_REFUND_REJECTED, {
        adminUserId: admin.id,
        resource: `order:${refund.order.orderNumber}`,
        payload: { refundNumber: refund.refundNumber, reason },
      });
      return updated;
    });
  }
}
