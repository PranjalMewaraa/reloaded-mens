import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@repo/db';
import type { CreatePosOrderRequest, PosOrderListQuery, PromotionAction } from '@repo/types';
import { BillGenerator } from './bill.generator.js';
import { resolve } from 'node:path';

// Matches the next-order-number pattern used in PublicCheckoutService.
// Reads the max existing number and increments.
async function nextOrderNumber(): Promise<string> {
  const latest = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });
  const n = latest ? parseInt(latest.orderNumber.replace('RLD-', ''), 10) + 1 : 1;
  return `RLD-${String(n).padStart(6, '0')}`;
}

function resolveStorage(config: ConfigService): string {
  const fromEnv = config.get<string>('STORAGE_LOCAL_PATH')?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : resolve(process.cwd(), 'uploads');
}

@Injectable()
export class PosService {
  private readonly logger = new Logger('PosService');

  constructor(
    private readonly config: ConfigService,
    private readonly billGen: BillGenerator,
  ) {}

  // ── Settings ──────────────────────────────────────────────────────

  async getSettings() {
    const keys = [
      'pos.upi_id',
      'pos.upi_display_name',
      'pos.bill_footer_note',
      'business.name',
      'business.address',
      'business.phone_primary',
      'business.gstin',
    ];

    const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
    const get = (k: string, fallback = '') =>
      (rows.find((r) => r.key === k)?.value as string | null) ?? fallback;

    return {
      upiId: get('pos.upi_id', ''),
      upiDisplayName: get('pos.upi_display_name', get('business.name', 'Reloaded Mens')),
      billFooterNote: get('pos.bill_footer_note', 'Thank you for shopping with us!'),
      storeName: get('business.name', 'Reloaded Mens'),
      storeAddress: get('business.address', 'L-285 Sector 23 Sanjay Nagar, Ghaziabad'),
      storePhone: get('business.phone_primary', '+919958247377'),
      gstin: get('business.gstin', null) || null,
    };
  }

  // ── Product search ────────────────────────────────────────────────

  async searchProducts(q: string, page = 1) {
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const where = {
      deletedAt: null,
      isActive: true,
      ...(q.trim().length > 0
        ? { name: { contains: q.trim(), mode: 'insensitive' as const } }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          variants: {
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              priceOverridePaisa: true,
              stockCount: true,
              isActive: true,
            },
          },
          basePricePaisa: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      total,
      products: products.map((p) => {
        const images = Array.isArray(p.images) ? (p.images as { url: string }[]) : [];
        const imageUrl = images[0]?.url ?? null;

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          imageUrl,
          variants: p.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            size: v.size,
            color: v.color,
            label: [v.size, v.color].filter(Boolean).join(' · ') || v.sku,
            pricePaisa: v.priceOverridePaisa ?? p.basePricePaisa,
            stockCount: v.stockCount,
            isActive: v.isActive,
          })),
        };
      }),
    };
  }

  // ── Create POS order ──────────────────────────────────────────────

  async createOrder(body: CreatePosOrderRequest) {
    // 1. Validate all variants exist and have enough stock
    const variantIds = body.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null },
      include: { product: { select: { name: true, basePricePaisa: true } } },
    });

    if (variants.length !== variantIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    const stockErrors: string[] = [];
    for (const item of body.items) {
      const v = variants.find((x) => x.id === item.variantId)!;
      if (v.stockCount < item.quantity) {
        stockErrors.push(
          `${v.product.name} (${v.size ?? v.sku}): only ${v.stockCount} in stock`,
        );
      }
    }
    if (stockErrors.length > 0) {
      throw new BadRequestException(`Insufficient stock: ${stockErrors.join('; ')}`);
    }

    // 2. Compute totals
    let subtotalPaisa = 0;
    const lineItems = body.items.map((item) => {
      const v = variants.find((x) => x.id === item.variantId)!;
      const pricePaisa = v.priceOverridePaisa ?? v.product.basePricePaisa;
      const totalPaisa = pricePaisa * item.quantity;
      subtotalPaisa += totalPaisa;
      return { variant: v, quantity: item.quantity, pricePaisa, totalPaisa };
    });

    // 3. Apply coupon if provided — look up via Promotion.actions JSON
    let discountPaisa = 0;
    let appliedCoupon: string | null = null;
    if (body.couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: { code: body.couponCode.toUpperCase().trim(), isActive: true },
        include: {
          promotion: {
            select: { isActive: true, actions: true, validFrom: true, validTo: true },
          },
        },
      });
      if (coupon && coupon.promotion.isActive) {
        const now = new Date();
        const withinWindow =
          (!coupon.promotion.validFrom || coupon.promotion.validFrom <= now) &&
          (!coupon.promotion.validTo || coupon.promotion.validTo >= now);
        if (withinWindow) {
          const actions = coupon.promotion.actions as PromotionAction[];
          const action = actions.find(
            (a) => a.type === 'percent_off_order' || a.type === 'flat_off_order',
          );
          if (action) {
            if (action.type === 'percent_off_order') {
              discountPaisa = Math.floor((subtotalPaisa * action.percent) / 100);
            } else if (action.type === 'flat_off_order') {
              discountPaisa = Math.min(action.amountPaisa, subtotalPaisa);
            }
            appliedCoupon = coupon.code;
          }
        }
      }
    }

    const totalPaisa = subtotalPaisa - discountPaisa;
    const orderNumber = await nextOrderNumber();
    const idempotencyKey = `pos-${orderNumber}-${Date.now()}`;

    // 4. Upsert customer by phone
    const customer = await prisma.customer.upsert({
      where: { phone: body.customerPhone },
      create: {
        phone: body.customerPhone,
        name: body.customerName ?? null,
        email: body.customerEmail ?? null,
      },
      update: {
        ...(body.customerName ? { name: body.customerName } : {}),
        ...(body.customerEmail ? { email: body.customerEmail } : {}),
      },
    });

    const settings = await this.getSettings();

    // 5. Create order in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          idempotencyKey,
          state: 'confirmed',
          paymentState: 'paid',
          source: 'pos',
          subtotalPaisa,
          discountPaisa,
          shippingPaisa: 0,
          taxPaisa: 0,
          totalPaisa,
          appliedCouponCode: appliedCoupon,
          contactSnapshot: {
            name: body.customerName ?? '',
            phone: body.customerPhone,
            email: body.customerEmail ?? '',
          },
          // POS = in-store; use store address as shipping snapshot
          shippingAddressSnapshot: {
            name: body.customerName ?? 'Walk-in Customer',
            phone: body.customerPhone,
            line1: settings.storeAddress,
            line2: '',
            city: 'Ghaziabad',
            state: 'Uttar Pradesh',
            pincode: '201002',
            country: 'IN',
          },
          confirmedAt: new Date(),
          items: {
            create: lineItems.map((li) => ({
              variantId: li.variant.id,
              productName: li.variant.product.name,
              variantLabel:
                [li.variant.size, li.variant.color].filter(Boolean).join(' · ') || null,
              sku: li.variant.sku,
              quantity: li.quantity,
              unitPricePaisa: li.pricePaisa,
              totalPaisa: li.totalPaisa,
            })),
          },
        },
      });

      // 6. Deduct inventory
      for (const li of lineItems) {
        await tx.productVariant.update({
          where: { id: li.variant.id },
          data: { stockCount: { decrement: li.quantity } },
        });

        await tx.inventoryEvent.create({
          data: {
            variantId: li.variant.id,
            changeType: 'store_sale',
            delta: -li.quantity,
            stockBefore: li.variant.stockCount,
            stockAfter: li.variant.stockCount - li.quantity,
            actor: 'staff',
            referenceId: o.id,
            note: `POS sale — ${orderNumber}`,
          },
        });
      }

      // 7. Update customer totals
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: { increment: 1 },
          totalRevenuePaisa: { increment: BigInt(totalPaisa) },
        },
      });

      return o;
    });

    // 8. Generate PDF bill
    const storagePath = resolveStorage(this.config);
    const publicApiUrl = this.config.get<string>('PUBLIC_API_URL') ?? '';

    const billRelPath = await this.billGen.generate(
      {
        orderNumber,
        date: new Date(),
        customerName: body.customerName ?? null,
        customerPhone: body.customerPhone,
        items: lineItems.map((li) => ({
          name: li.variant.product.name,
          variantLabel:
            [li.variant.size, li.variant.color].filter(Boolean).join(' · ') || null,
          quantity: li.quantity,
          pricePaisa: li.pricePaisa,
          totalPaisa: li.totalPaisa,
        })),
        subtotalPaisa,
        discountPaisa,
        totalPaisa,
        couponCode: appliedCoupon,
        storeName: settings.storeName,
        storeAddress: settings.storeAddress,
        storePhone: settings.storePhone,
        footerNote: settings.billFooterNote,
        gstin: settings.gstin,
      },
      storagePath,
    );

    const billPdfUrl = `${publicApiUrl}/files/${billRelPath}`;

    // 9. Save PDF URL on order
    await prisma.order.update({
      where: { id: order.id },
      data: { billPdfUrl },
    });

    // 10. Build WhatsApp URL
    const totalInRupees = (totalPaisa / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    });
    const waText = encodeURIComponent(
      `Hi! Here is your bill from ${settings.storeName} 🛍️\n\n` +
        `Bill No: ${orderNumber}\n` +
        `Amount: ${totalInRupees}\n\n` +
        `Download your bill: ${billPdfUrl}\n\n` +
        `Thank you for shopping with us! 🙏`,
    );
    const cleanPhone = body.customerPhone.replace('+', '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${waText}`;

    this.logger.log(`POS order created: ${orderNumber} ₹${totalPaisa / 100}`);

    return {
      orderNumber,
      totalPaisa,
      discountPaisa,
      billPdfUrl,
      whatsappUrl,
      customerPhone: body.customerPhone,
      customerName: body.customerName ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  }

  // ── List POS orders ───────────────────────────────────────────────

  async listOrders(query: PosOrderListQuery) {
    const { page, pageSize, period } = query;
    const skip = (page - 1) * pageSize;

    let dateFilter: Date | undefined;
    const now = new Date();
    if (period === 'today') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const where = {
      source: 'pos',
      deletedAt: null,
      ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          totalPaisa: true,
          discountPaisa: true,
          contactSnapshot: true,
          billPdfUrl: true,
          createdAt: true,
          items: { select: { id: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const settings = await this.getSettings();

    return {
      total,
      page,
      pageSize,
      orders: orders.map((o) => {
        const contact = o.contactSnapshot as { name?: string; phone?: string };
        const phone = contact.phone ?? '';
        const name = contact.name ?? null;

        let whatsappUrl: string | null = null;
        if (o.billPdfUrl && phone) {
          const totalInRupees = (o.totalPaisa / 100).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
          });
          const waText = encodeURIComponent(
            `Hi! Here is your bill from ${settings.storeName} 🛍️\n\n` +
              `Bill No: ${o.orderNumber}\n` +
              `Amount: ${totalInRupees}\n\n` +
              `Download your bill: ${o.billPdfUrl}\n\n` +
              `Thank you for shopping with us! 🙏`,
          );
          const cleanPhone = phone.replace('+', '');
          whatsappUrl = `https://wa.me/${cleanPhone}?text=${waText}`;
        }

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: name,
          customerPhone: phone,
          totalPaisa: o.totalPaisa,
          itemCount: o.items.length,
          billPdfUrl: o.billPdfUrl,
          whatsappUrl,
          createdAt: o.createdAt.toISOString(),
        };
      }),
    };
  }
}
