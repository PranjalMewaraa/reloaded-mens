import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import type {
  ContactInfo,
  CustomerOrderListResponse,
  OrderSnapshot,
  ShippingAddress,
} from '@repo/types';

interface ListParams {
  page: number;
  limit: number;
}

@Injectable()
export class CustomerOrdersService {
  async list(customerId: string, params: ListParams): Promise<CustomerOrderListResponse> {
    const where: Prisma.OrderWhereInput = { customerId, deletedAt: null };
    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { items: { orderBy: { createdAt: 'asc' }, take: 1 } },
      }),
    ]);
    return {
      items: rows.map((o) => ({
        orderNumber: o.orderNumber,
        state: o.state,
        paymentState: o.paymentState,
        totalPaisa: o.totalPaisa,
        itemCount: o.items.length === 0 ? 0 : Math.max(o.items.length, 1),
        primaryProductName: o.items[0]?.productName ?? '—',
        placedAt: o.placedAt.toISOString(),
        trackingToken: o.trackingToken,
      })),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async getOrderForCustomer(customerId: string, orderNumber: string): Promise<OrderSnapshot> {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order || order.deletedAt || order.customerId !== customerId) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }
    return shapeOrderSnapshot(order);
  }
}

function shapeOrderSnapshot(
  order: Prisma.OrderGetPayload<{ include: { items: true } }>,
): OrderSnapshot {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    state: order.state as OrderSnapshot['state'],
    paymentState: order.paymentState as OrderSnapshot['paymentState'],
    subtotalPaisa: order.subtotalPaisa,
    discountPaisa: order.discountPaisa,
    shippingPaisa: order.shippingPaisa,
    taxPaisa: order.taxPaisa,
    totalPaisa: order.totalPaisa,
    appliedCouponCode: order.appliedCouponCode,
    appliedPromotionIds: order.appliedPromotionIds,
    contact: order.contactSnapshot as unknown as ContactInfo,
    shippingAddress: order.shippingAddressSnapshot as unknown as ShippingAddress,
    etaDateFrom: order.etaDateFrom?.toISOString() ?? null,
    etaDateTo: order.etaDateTo?.toISOString() ?? null,
    placedAt: order.placedAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantLabel: i.variantLabel,
      sku: i.sku,
      quantity: i.quantity,
      unitPricePaisa: i.unitPricePaisa,
      totalPaisa: i.totalPaisa,
    })),
  };
}
