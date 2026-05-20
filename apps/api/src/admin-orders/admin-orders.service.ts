import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  ACTOR,
  ADMIN_ROLE,
  AUDIT_EVENT_TYPE,
  INVENTORY_CHANGE_TYPE,
  ORDER_EVENT_TYPE,
  ORDER_STATE,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type AdminOrderListQuery,
  type CancelOrderRequest,
  type ContactInfo,
  type OrderEventResponse,
  type OrderState,
  type ShippingAddress,
  type TransitionOrderRequest,
} from '@repo/types';
import {
  canAdminCancel,
  canStaffCancel,
  canTransition,
  transitionTimestampField,
} from '../orders/order-state-machine.js';
import { AuditService } from '../audit/audit.service.js';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SERVICE, type EmailService } from '../email/email.types.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { SHIPPING_PROVIDER_TOKEN, type ShippingProviderImpl } from '../shipping/shipping.types.js';

// Admin-facing order operations. All endpoints assume the caller passed
// JwtAccessGuard + RolesGuard (controller-level). Sensitive transitions check the
// caller's role inline since staff and admin have different cancel windows.

@Injectable()
export class AdminOrdersService {
  // Module-scoped logger — Nest formats output as "[AdminOrders] LEVEL …"
  // so it's easy to filter in `docker compose logs api | grep AdminOrders`.
  private readonly logger = new Logger('AdminOrders');

  constructor(
    private readonly audit: AuditService,
    private readonly reviews: ReviewsService,
    private readonly config: ConfigService,
    @Inject(SHIPPING_PROVIDER_TOKEN) private readonly shipping: ShippingProviderImpl,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {}

  // -------- GET /orders --------

  async list(query: AdminOrderListQuery) {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (query.state) where.state = query.state;
    if (query.paymentState) where.paymentState = query.paymentState;
    if (query.dateFrom || query.dateTo) {
      where.placedAt = {};
      if (query.dateFrom) where.placedAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.placedAt.lte = new Date(query.dateTo);
    }
    if (query.q) {
      // Match on orderNumber, customer phone/email (relation), or the snapshotted
      // contact name. Postgres JSON path filters are awkward — we OR across
      // orderNumber, the customer relation, and a string-cast on contactSnapshot.
      const q = query.q.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          orderNumber: true,
          state: true,
          paymentState: true,
          totalPaisa: true,
          placedAt: true,
          updatedAt: true,
          contactSnapshot: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    const items: AdminOrderListItem[] = rows.map((r) => {
      const contact = (r.contactSnapshot as unknown as ContactInfo | null) ?? {
        name: 'Unknown',
        phone: '',
      };
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        customerName: contact.name ?? 'Unknown',
        customerPhone: contact.phone ?? '',
        state: r.state,
        paymentState: r.paymentState,
        totalPaisa: r.totalPaisa,
        itemCount: r._count.items,
        placedAt: r.placedAt.toISOString(),
        lastEventAt: r.updatedAt.toISOString(),
      };
    });

    return { items, page: query.page, limit: query.limit, total };
  }

  // -------- GET /orders/:id --------

  async getDetail(idOrNumber: string): Promise<AdminOrderDetail> {
    const order = await prisma.order.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
        refundRequests: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!order) throw new NotFoundException(`Order ${idOrNumber} not found`);
    return shapeAdminDetail(order);
  }

  // -------- POST /orders/:id/transition --------

  async transition(
    idOrNumber: string,
    body: TransitionOrderRequest,
    actor: { id: string; role: string },
  ): Promise<AdminOrderDetail> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { deletedAt: null, OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      });
      if (!order) throw new NotFoundException(`Order ${idOrNumber} not found`);

      const target = body.target as OrderState;
      if (!canTransition(order.state as OrderState, target)) {
        throw new BadRequestException(
          `Cannot transition order in state "${order.state}" to "${target}"`,
        );
      }

      // For target=shipped, auto-generate a tracking number if the admin didn't
      // provide one. Mirrors real-carrier behaviour where you can either type the
      // AWB in or let the integration assign it.
      let trackingNumber = body.trackingNumber ?? null;
      if (target === ORDER_STATE.SHIPPED && !trackingNumber) {
        try {
          const awb = await this.shipping.assignAwb({
            orderId: order.id,
            orderNumber: order.orderNumber,
          });
          trackingNumber = awb.trackingNumber;
        } catch (err) {
          // Shipping provider call failed (mock won't, but real Shiprocket
          // can on rate-limit / API downtime). Surface in logs and re-throw
          // so the admin sees the failure instead of silently proceeding
          // to "shipped" without a tracking number.
          this.logger.error(
            `assignAwb failed for ${order.orderNumber} on transition to shipped`,
            err instanceof Error ? err.stack : String(err),
          );
          throw new BadRequestException(
            'Could not assign a tracking number from the carrier. Try again or enter one manually.',
          );
        }
      }

      const timestampField = transitionTimestampField(target);
      const updateData: Prisma.OrderUpdateInput = { state: target };
      if (timestampField) {
        (updateData as Record<string, unknown>)[timestampField] = new Date();
      }
      if (trackingNumber) updateData.trackingNumber = trackingNumber;

      const updated = await tx.order.update({
        where: { id: order.id },
        data: updateData,
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
          refundRequests: { orderBy: { createdAt: 'desc' } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      const eventType = stateToEventType(target);
      const message = body.message ?? humanLabel(target);
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType,
          message,
          actor: roleToActor(actor.role),
          actorId: actor.id,
          payload: trackingNumber ? { trackingNumber } : undefined,
        },
      });
      if (trackingNumber && trackingNumber !== order.trackingNumber) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: ORDER_EVENT_TYPE.TRACKING_ASSIGNED,
            actor: roleToActor(actor.role),
            actorId: actor.id,
            message: `Tracking number ${trackingNumber}`,
            payload: { trackingNumber },
          },
        });
      }

      await this.audit.write(AUDIT_EVENT_TYPE.ORDER_STATE_CHANGED, {
        adminUserId: actor.id,
        resource: `order:${order.orderNumber}`,
        payload: { from: order.state, to: target, trackingNumber },
      });

      // Successful transition — log the actor + transition so we can grep
      // the lifecycle of any order out of `docker compose logs api`. Audit
      // log captures the same plus IP / UA, but the api log is closer to
      // the actual request and easier to live-tail.
      this.logger.log(
        `transition ${order.orderNumber} ${order.state} → ${target} actor=${actor.id}${
          trackingNumber ? ` awb=${trackingNumber}` : ''
        }`,
      );

      return shapeAdminDetail(updated);
    });
  }

  // -------- POST /orders/:id/cancel --------

  async cancel(
    idOrNumber: string,
    body: CancelOrderRequest,
    actor: { id: string; role: string },
  ): Promise<AdminOrderDetail> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { deletedAt: null, OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Order ${idOrNumber} not found`);

      const current = order.state as OrderState;
      const allowed =
        actor.role === ADMIN_ROLE.ADMIN ? canAdminCancel(current) : canStaffCancel(current);
      if (!allowed) {
        throw new ForbiddenException(
          `${actor.role} cannot cancel an order in state "${current}"`,
        );
      }

      // Restock — re-increment each variant's stockCount and write an
      // InventoryEvent row. Admin can opt out via body.restock=false for fraud
      // cases where the merchandise isn't actually coming back.
      if (body.restock) {
        for (const item of order.items) {
          const updatedVariant = await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockCount: { increment: item.quantity } },
            select: { stockCount: true },
          });
          await tx.inventoryEvent.create({
            data: {
              variantId: item.variantId,
              changeType: INVENTORY_CHANGE_TYPE.RETURN_RESTOCK,
              delta: item.quantity,
              stockBefore: updatedVariant.stockCount - item.quantity,
              stockAfter: updatedVariant.stockCount,
              actor: roleToActor(actor.role),
              actorId: actor.id,
              referenceId: order.id,
              note: `Order ${order.orderNumber} cancelled`,
            },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          state: ORDER_STATE.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: body.reason,
        },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
          refundRequests: { orderBy: { createdAt: 'desc' } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: ORDER_EVENT_TYPE.STATE_CANCELLED,
          message: body.reason,
          actor: roleToActor(actor.role),
          actorId: actor.id,
          payload: { restocked: body.restock },
        },
      });

      await this.audit.write(AUDIT_EVENT_TYPE.ORDER_CANCELLED, {
        adminUserId: actor.id,
        resource: `order:${order.orderNumber}`,
        payload: { reason: body.reason, restocked: body.restock },
      });

      this.logger.log(
        `cancel ${order.orderNumber} actor=${actor.id} role=${actor.role} restocked=${body.restock} reason="${body.reason}"`,
      );

      return shapeAdminDetail(updated);
    });
  }

  // -------- PATCH /orders/:id/note --------

  async updateNote(
    idOrNumber: string,
    note: string,
    actor: { id: string; role: string },
  ): Promise<AdminOrderDetail> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { deletedAt: null, OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      });
      if (!order) throw new NotFoundException(`Order ${idOrNumber} not found`);
      const previous = order.internalNote;
      const next = note.trim().length === 0 ? null : note;
      if (previous === next) {
        // No-op — just return the order without churning the timeline.
        return this.getDetail(order.id);
      }
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { internalNote: next },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
          refundRequests: { orderBy: { createdAt: 'desc' } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: ORDER_EVENT_TYPE.NOTE_UPDATED,
          message: 'Internal note updated',
          actor: roleToActor(actor.role),
          actorId: actor.id,
        },
      });

      await this.audit.write(AUDIT_EVENT_TYPE.ORDER_NOTE_UPDATED, {
        adminUserId: actor.id,
        resource: `order:${order.orderNumber}`,
        payload: { length: next?.length ?? 0 },
      });

      return shapeAdminDetail(updated);
    });
  }

  // -------- GET /orders/:id/label --------

  async renderLabel(idOrNumber: string): Promise<string> {
    const order = await prisma.order.findFirst({
      where: { deletedAt: null, OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException(`Order ${idOrNumber} not found`);
    const snapshot = await this.getDetail(order.id);
    try {
      const html = await this.shipping.renderLabelHtml({
        order: {
          ...snapshot,
          trackingToken: order.trackingToken,
          // OrderSnapshot expects items as the snapshot shape — the detail's items are
          // already in that form so this passes through.
        } as unknown as Parameters<ShippingProviderImpl['renderLabelHtml']>[0]['order'],
      });
      this.logger.log(`label rendered ${order.orderNumber}`);
      return html;
    } catch (err) {
      this.logger.error(
        `renderLabelHtml failed for ${order.orderNumber}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  // -------- Internal helper for refunds module --------

  async assertOrderExists(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, state: true, paymentState: true, totalPaisa: true, orderNumber: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return order;
  }

  // -------- POST /orders/:id/send-review-invite --------

  async sendReviewInvite(orderId: string, actor: { id: string }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            variantLabel: true,
            variant: { select: { product: { select: { slug: true } } } },
          },
        },
        customer: { select: { id: true, name: true, email: true } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.state !== ORDER_STATE.DELIVERED) {
      throw new BadRequestException('Review invites can only be sent for delivered orders');
    }
    const snapshot = order.contactSnapshot as Partial<ContactInfo> | null;
    const to = order.customer?.email ?? snapshot?.email ?? null;
    if (!to) {
      throw new BadRequestException('No email on file for this order');
    }
    const storefrontUrl =
      this.config.get<string>('NEXT_PUBLIC_STOREFRONT_URL') ?? 'http://localhost:3000';
    const links = this.reviews.buildReviewLinksForOrder({
      storefrontUrl,
      orderId: order.id,
      customerId: order.customer?.id ?? null,
      items: order.items.map((i) => ({ id: i.id })),
    });
    const linkByItem = new Map(links.map((l) => [l.orderItemId, l.reviewUrl]));

    await this.email.sendReviewInvite({
      to,
      customerName: order.customer?.name ?? snapshot?.name ?? '',
      orderNumber: order.orderNumber,
      items: order.items.map((i) => ({
        orderItemId: i.id,
        productName: i.productName,
        productSlug: i.variant.product.slug,
        variantLabel: i.variantLabel,
        reviewUrl: linkByItem.get(i.id) ?? `${storefrontUrl}`,
      })),
    });
    await this.audit.write(AUDIT_EVENT_TYPE.REVIEW_INVITE_SENT, {
      adminUserId: actor.id,
      resource: `order:${order.id}`,
      payload: { to, items: order.items.length },
    });
    return { ok: true, to, items: order.items.length };
  }
}

// =====================================================
// Helpers
// =====================================================

type AdminOrderRow = Prisma.OrderGetPayload<{
  include: {
    items: true;
    events: true;
    refundRequests: true;
    payments: true;
  };
}>;

function shapeAdminDetail(order: AdminOrderRow): AdminOrderDetail {
  const payment = order.payments[0] ?? null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    state: order.state,
    paymentState: order.paymentState,
    subtotalPaisa: order.subtotalPaisa,
    discountPaisa: order.discountPaisa,
    shippingPaisa: order.shippingPaisa,
    taxPaisa: order.taxPaisa,
    totalPaisa: order.totalPaisa,
    appliedCouponCode: order.appliedCouponCode,
    appliedPromotionIds: order.appliedPromotionIds,
    contact: order.contactSnapshot as unknown as ContactInfo,
    shippingAddress: order.shippingAddressSnapshot as unknown as ShippingAddress,
    internalNote: order.internalNote,
    customerNote: order.customerNote,
    trackingNumber: order.trackingNumber,
    trackingToken: order.trackingToken,
    etaDateFrom: order.etaDateFrom?.toISOString() ?? null,
    etaDateTo: order.etaDateTo?.toISOString() ?? null,
    placedAt: order.placedAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    packedAt: order.packedAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    outForDeliveryAt: order.outForDeliveryAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantLabel: i.variantLabel,
      sku: i.sku,
      quantity: i.quantity,
      unitPricePaisa: i.unitPricePaisa,
      totalPaisa: i.totalPaisa,
    })),
    events: order.events.map(shapeEvent),
    refunds: order.refundRequests.map((r) => ({
      id: r.id,
      refundNumber: r.refundNumber,
      status: r.status as AdminOrderDetail['refunds'][number]['status'],
      amountPaisa: r.amountPaisa,
      reason: r.reason,
      requestedBy: r.requestedBy,
      approvedBy: r.approvedBy,
      rejectedReason: r.rejectedReason,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
    payment: payment
      ? {
          id: payment.id,
          provider: payment.provider,
          status: payment.status,
          amountPaisa: payment.amountPaisa,
          capturedAt: payment.capturedAt?.toISOString() ?? null,
        }
      : null,
  };
}

function shapeEvent(event: Prisma.OrderEventGetPayload<Record<string, never>>): OrderEventResponse {
  return {
    id: event.id,
    eventType: event.eventType,
    message: event.message,
    actor: event.actor as OrderEventResponse['actor'],
    actorId: event.actorId,
    payload: (event.payload as Record<string, unknown> | null) ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

function stateToEventType(target: OrderState): string {
  switch (target) {
    case ORDER_STATE.CONFIRMED:
      return ORDER_EVENT_TYPE.STATE_CONFIRMED;
    case ORDER_STATE.PACKED:
      return ORDER_EVENT_TYPE.STATE_PACKED;
    case ORDER_STATE.SHIPPED:
      return ORDER_EVENT_TYPE.STATE_SHIPPED;
    case ORDER_STATE.OUT_FOR_DELIVERY:
      return ORDER_EVENT_TYPE.STATE_OUT_FOR_DELIVERY;
    case ORDER_STATE.DELIVERED:
      return ORDER_EVENT_TYPE.STATE_DELIVERED;
    case ORDER_STATE.CANCELLED:
      return ORDER_EVENT_TYPE.STATE_CANCELLED;
    default:
      return `state.${target}`;
  }
}

function humanLabel(target: OrderState): string {
  return target.replace(/_/g, ' ');
}

function roleToActor(role: string): 'staff' | 'admin' | 'system' {
  if (role === ADMIN_ROLE.ADMIN) return ACTOR.ADMIN;
  if (role === ADMIN_ROLE.STAFF) return ACTOR.STAFF;
  return ACTOR.SYSTEM;
}
