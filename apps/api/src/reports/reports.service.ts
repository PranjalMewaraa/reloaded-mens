import { Injectable } from '@nestjs/common';
import { prisma } from '@repo/db';
import type {
  ReportSalesByDayResponse,
  ReportSummary,
  ReportTopCustomersResponse,
  ReportTopProductsResponse,
} from '@repo/types';

// "Paid" orders for revenue calculation. We don't count payment_pending or
// cancelled / payment_failed / refunded as revenue. Refunded is reported
// separately in the summary's refundedPaisa.
const PAID_STATES = [
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const;

@Injectable()
export class ReportsService {
  // SUMMARY ===================================================================

  async summary(from: Date, to: Date): Promise<ReportSummary> {
    // Run the four aggregate queries concurrently — each is independent.
    const [paid, refunded, newCustomerCount, deliveredCount, returnsCount] = await Promise.all([
      // Paid orders sum + count.
      prisma.order.aggregate({
        where: {
          placedAt: { gte: from, lte: to },
          state: { in: [...PAID_STATES] },
          deletedAt: null,
        },
        _sum: { totalPaisa: true },
        _count: { _all: true },
      }),
      // Refunded amount in the range. Refunds carry a refundedPaisa column on
      // the Refund table; we sum approved refunds whose createdAt falls in
      // the range.
      prisma.refundRequest.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          // Count both approved + completed — once approved, money is committed
          // even if the upstream provider call is still settling.
          status: { in: ['approved', 'completed'] },
        },
        _sum: { amountPaisa: true },
      }),
      // New customers in the range — first order placed in this window.
      // Using groupBy customerId + min(placedAt) would be more "correct" but
      // the simpler proxy is: customers whose createdAt falls in the range.
      prisma.customer.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      // Delivered orders in range — denominator for return rate.
      prisma.order.count({
        where: {
          deliveredAt: { gte: from, lte: to },
          state: 'delivered',
          deletedAt: null,
        },
      }),
      // Returns initiated in range — numerator for return rate.
      prisma.returnRequest.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
    ]);

    const totalRevenuePaisa = paid._sum.totalPaisa ?? 0;
    const orderCount = paid._count._all;
    const aov = orderCount > 0 ? Math.round(totalRevenuePaisa / orderCount) : 0;

    // Return rate as a percentage; 0 when no deliveries to avoid /0.
    const returnRatePercent =
      deliveredCount > 0 ? Math.round((returnsCount / deliveredCount) * 1000) / 10 : 0;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenuePaisa,
      orderCount,
      averageOrderValuePaisa: aov,
      refundedPaisa: refunded._sum.amountPaisa ?? 0,
      newCustomerCount,
      returnRatePercent,
    };
  }

  // SALES BY DAY ==============================================================

  async salesByDay(from: Date, to: Date): Promise<ReportSalesByDayResponse> {
    // Raw SQL — Postgres date_trunc + sum keeps this single-query instead of
    // pulling N orders into Node and bucketing in JS. Parameterised via Prisma
    // to keep it injection-safe.
    const rows = await prisma.$queryRaw<
      Array<{ date: Date; revenue_paisa: bigint; order_count: bigint }>
    >`
      SELECT
        date_trunc('day', "placedAt") AS date,
        SUM("totalPaisa")::bigint AS revenue_paisa,
        COUNT(*)::bigint AS order_count
      FROM "Order"
      WHERE "placedAt" BETWEEN ${from} AND ${to}
        AND "state" IN ('confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered')
        AND "deletedAt" IS NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return {
      items: rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        revenuePaisa: Number(r.revenue_paisa),
        orderCount: Number(r.order_count),
      })),
    };
  }

  // TOP PRODUCTS ==============================================================

  async topProducts(from: Date, to: Date, limit: number): Promise<ReportTopProductsResponse> {
    // groupBy on OrderItem joined to Order with state filter. Sum units +
    // revenue per (productId or, fallback, productName when productId is
    // null because the product was later soft-deleted but its OrderItem
    // snapshot survives).
    const rows = await prisma.$queryRaw<
      Array<{
        product_id: string | null;
        product_name: string;
        product_slug: string | null;
        units_sold: bigint;
        revenue_paisa: bigint;
      }>
    >`
      SELECT
        p."id" AS product_id,
        oi."productName" AS product_name,
        p."slug" AS product_slug,
        SUM(oi."quantity")::bigint AS units_sold,
        SUM(oi."totalPaisa")::bigint AS revenue_paisa
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "Variant" v ON v."id" = oi."variantId"
      LEFT JOIN "Product" p ON p."id" = v."productId"
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."state" IN ('confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered')
        AND o."deletedAt" IS NULL
      GROUP BY p."id", oi."productName", p."slug"
      ORDER BY revenue_paisa DESC
      LIMIT ${limit}
    `;

    return {
      items: rows.map((r) => ({
        productId: r.product_id ?? r.product_name,
        productName: r.product_name,
        productSlug: r.product_slug ?? '',
        unitsSold: Number(r.units_sold),
        revenuePaisa: Number(r.revenue_paisa),
      })),
    };
  }

  // TOP CUSTOMERS =============================================================

  async topCustomers(from: Date, to: Date, limit: number): Promise<ReportTopCustomersResponse> {
    const rows = await prisma.$queryRaw<
      Array<{
        customer_id: string;
        name: string | null;
        phone: string;
        email: string | null;
        order_count: bigint;
        total_spent_paisa: bigint;
      }>
    >`
      SELECT
        c."id" AS customer_id,
        c."name" AS name,
        c."phone" AS phone,
        c."email" AS email,
        COUNT(o."id")::bigint AS order_count,
        SUM(o."totalPaisa")::bigint AS total_spent_paisa
      FROM "Order" o
      JOIN "Customer" c ON c."id" = o."customerId"
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."state" IN ('confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered')
        AND o."deletedAt" IS NULL
      GROUP BY c."id", c."name", c."phone", c."email"
      ORDER BY total_spent_paisa DESC
      LIMIT ${limit}
    `;

    return {
      items: rows.map((r) => ({
        customerId: r.customer_id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        orderCount: Number(r.order_count),
        totalSpentPaisa: Number(r.total_spent_paisa),
      })),
    };
  }
}
