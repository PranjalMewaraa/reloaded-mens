import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  ACTOR,
  INVENTORY_CHANGE_TYPE,
  ORDER_EVENT_TYPE,
  ORDER_STATE,
  type ContactInfo,
  type CustomerCancelRequest,
  type OrderEventResponse,
  type OrderState,
  type ShippingAddress,
  type TrackingOrder,
} from '@repo/types';
import { canCustomerCancel } from '../orders/order-state-machine.js';
import { TrackingTokenService } from './tracking-token.service.js';

// Customer-safe event types — never expose internal note edits, refund debate, or
// admin/staff actor identities through the tracking page.
const CUSTOMER_SAFE_EVENT_TYPES = new Set<string>([
  ORDER_EVENT_TYPE.STATE_CONFIRMED,
  ORDER_EVENT_TYPE.STATE_PACKED,
  ORDER_EVENT_TYPE.STATE_SHIPPED,
  ORDER_EVENT_TYPE.STATE_OUT_FOR_DELIVERY,
  ORDER_EVENT_TYPE.STATE_DELIVERED,
  ORDER_EVENT_TYPE.STATE_CANCELLED,
  ORDER_EVENT_TYPE.PAYMENT_CAPTURED,
  ORDER_EVENT_TYPE.PAYMENT_FAILED,
  ORDER_EVENT_TYPE.PAYMENT_REFUNDED,
  ORDER_EVENT_TYPE.TRACKING_ASSIGNED,
]);

@Injectable()
export class PublicTrackingService {
  constructor(private readonly tokens: TrackingTokenService) {}

  // -------- GET /public/tracking/:orderNumber --------

  async getTracking(orderNumber: string, token: string): Promise<TrackingOrder> {
    if (!token) throw new UnauthorizedException('Missing tracking token');
    const order = await prisma.order.findFirst({
      where: { orderNumber, deletedAt: null },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${orderNumber} not found`);
    if (!order.trackingToken) {
      // Historical Sprint 4 order — token was added in Sprint 5. Customer should
      // contact support via WhatsApp.
      throw new UnauthorizedException('Tracking is unavailable for this order');
    }
    if (!this.tokens.verify(order.trackingToken, token)) {
      throw new UnauthorizedException('Invalid tracking token');
    }

    return shapeTracking(order);
  }

  // -------- POST /public/tracking/:orderNumber/cancel --------

  async customerCancel(
    orderNumber: string,
    token: string,
    body: CustomerCancelRequest,
  ): Promise<TrackingOrder> {
    if (!token) throw new UnauthorizedException('Missing tracking token');
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { orderNumber, deletedAt: null },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Order ${orderNumber} not found`);
      if (!order.trackingToken || !this.tokens.verify(order.trackingToken, token)) {
        throw new UnauthorizedException('Invalid tracking token');
      }
      if (!canCustomerCancel(order.state as OrderState)) {
        throw new ConflictException({
          statusCode: 409,
          message: `Order is in "${order.state}" — too late to cancel from the storefront. Contact us on WhatsApp.`,
        });
      }

      // Restock — customer cancels always restock since the merchandise hasn't moved.
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
            actor: ACTOR.CUSTOMER,
            referenceId: order.id,
            note: `Order ${order.orderNumber} cancelled by customer`,
          },
        });
      }

      const reason = body.reason?.trim() || 'Cancelled by customer';
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          state: ORDER_STATE.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: ORDER_EVENT_TYPE.STATE_CANCELLED,
          message: reason,
          actor: ACTOR.CUSTOMER,
          payload: { restocked: true },
        },
      });
      // Refetch events so the just-created cancellation row is included.
      const events = await tx.orderEvent.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'asc' },
      });
      return { ...updated, events };
    });

    return shapeTracking(result);
  }
}

// =====================================================
// Helpers
// =====================================================

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { items: true; events: true };
}>;

function shapeTracking(order: OrderWithRelations): TrackingOrder {
  const events: OrderEventResponse[] = order.events
    .filter((e) => CUSTOMER_SAFE_EVENT_TYPES.has(e.eventType))
    .map((e) => ({
      id: e.id,
      eventType: e.eventType,
      message: e.message,
      // Customer view doesn't differentiate between admin/staff — both are "store".
      actor: e.actor === ACTOR.CUSTOMER ? ACTOR.CUSTOMER : ACTOR.SYSTEM,
      actorId: null,
      payload: (e.payload as Record<string, unknown> | null) ?? null,
      createdAt: e.createdAt.toISOString(),
    }));

  return {
    orderNumber: order.orderNumber,
    state: order.state,
    paymentState: order.paymentState,
    totalPaisa: order.totalPaisa,
    subtotalPaisa: order.subtotalPaisa,
    discountPaisa: order.discountPaisa,
    shippingPaisa: order.shippingPaisa,
    taxPaisa: order.taxPaisa,
    appliedCouponCode: order.appliedCouponCode,
    contact: order.contactSnapshot as unknown as ContactInfo,
    shippingAddress: order.shippingAddressSnapshot as unknown as ShippingAddress,
    trackingNumber: order.trackingNumber,
    etaDateFrom: order.etaDateFrom?.toISOString() ?? null,
    etaDateTo: order.etaDateTo?.toISOString() ?? null,
    placedAt: order.placedAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
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
    events,
    canCustomerCancel: canCustomerCancel(order.state as OrderState),
  };
}
