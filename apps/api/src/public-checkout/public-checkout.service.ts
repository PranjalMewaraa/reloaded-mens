import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  ACTOR,
  INVENTORY_CHANGE_TYPE,
  ORDER_EVENT_TYPE,
  ORDER_STATE,
  PAYMENT_STATE,
  type ContactInfo,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type MockWebhookEvent,
  type OrderSnapshot,
  type PaymentStatusResponse,
  type ShippingAddress,
} from '@repo/types';
import { OrderNumberingService } from './order-numbering.service.js';
import { PricingService } from './pricing.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { TrackingTokenService } from '../public-tracking/tracking-token.service.js';
import { PAYMENT_PROVIDER_TOKEN, type PaymentProviderImpl } from '../payments/payment.types.js';
import { EMAIL_SERVICE, type EmailService } from '../email/email.types.js';

// Public checkout — order creation, mock webhook ingestion, status polling. Stays
// unauthenticated; the order URL (RLD-NNNNNN) is the entropy. Sprint 8 will gate this
// behind customer OTP login.

@Injectable()
export class PublicCheckoutService {
  private readonly logger = new Logger('PublicCheckout');

  constructor(
    private readonly promotions: PromotionsService,
    private readonly numbering: OrderNumberingService,
    private readonly pricing: PricingService,
    private readonly tracking: TrackingTokenService,
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly payments: PaymentProviderImpl,
    @Inject(EMAIL_SERVICE) private readonly email: EmailService,
  ) {}

  // -------- POST /public/orders --------

  async createOrder(body: CreateOrderRequest): Promise<CreateOrderResponse> {
    // Short-circuit idempotency lookup. If we already created this order, return the
    // last payment session attached to it (or rebuild a fresh one if none exists).
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing) {
      const lastPayment = existing.payments[0];
      if (lastPayment) {
        return {
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          paymentSession: {
            provider: lastPayment.provider as 'mock' | 'phonepe',
            sessionId: lastPayment.providerSessionId,
            // Re-derive redirect URL — same shape as createSession returned.
            redirectUrl: `/checkout/processing?session=${lastPayment.providerSessionId}`,
            amountPaisa: lastPayment.amountPaisa,
          },
        };
      }
    }

    const shippingCfg = await this.pricing.getShippingConfig();
    // Pull every referenced variant once and validate. Catalog reads are NOT inside the
    // tx — we re-check stock inside the tx with a conditional update so concurrent
    // shoppers can't both grab the last unit.
    const variantIds = body.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null, isActive: true },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            basePricePaisa: true,
            hsnCode: true,
            gstRatePercent: true,
            availabilityFlag: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (variants.length !== variantIds.length) {
      throw new BadRequestException('One or more items are no longer available');
    }
    for (const v of variants) {
      if (!v.product || !v.product.isActive || v.product.deletedAt) {
        throw new BadRequestException(`Product for variant ${v.sku} is no longer available`);
      }
      if (v.product.availabilityFlag === 'in_store_only') {
        throw new BadRequestException(
          `"${v.product.name}" is in-store only — book a fitting via WhatsApp`,
        );
      }
    }

    // Compute line totals using server-side prices. We never trust the client to send
    // unitPricePaisa.
    const variantById = new Map(variants.map((v) => [v.id, v]));
    type ComputedLine = {
      variantId: string;
      productName: string;
      variantLabel: string | null;
      sku: string;
      hsnCode: string | null;
      gstRatePercent: number | null;
      quantity: number;
      unitPricePaisa: number;
      lineTotalPaisa: number;
      taxPaisa: number;
    };
    const lines: ComputedLine[] = body.items.map((i) => {
      const v = variantById.get(i.variantId)!;
      const unitPricePaisa = v.priceOverridePaisa ?? v.product.basePricePaisa;
      const lineTotalPaisa = unitPricePaisa * i.quantity;
      const taxPaisa = this.pricing.computeLineTax({
        unitPricePaisa,
        quantity: i.quantity,
        gstRatePercent: v.product.gstRatePercent,
      });
      const variantLabel = [v.size, v.color].filter(Boolean).join(' · ') || null;
      return {
        variantId: v.id,
        productName: v.product.name,
        variantLabel,
        sku: v.sku,
        hsnCode: v.product.hsnCode,
        gstRatePercent: v.product.gstRatePercent,
        quantity: i.quantity,
        unitPricePaisa,
        lineTotalPaisa,
        taxPaisa,
      };
    });

    const subtotalPaisa = lines.reduce((s, l) => s + l.lineTotalPaisa, 0);
    const taxPaisa = lines.reduce((s, l) => s + l.taxPaisa, 0);

    // Sprint 7 — re-run the cart evaluator server-side. The storefront has
    // already evaluated the cart but we never trust client-supplied discount
    // numbers; the evaluate() call replays the same engine using current DB
    // state. If a coupon's per-customer limit was hit between cart and submit,
    // commitForOrder() inside the tx fails with 409.
    const evaluation = await this.promotions.evaluate({
      lines: body.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      couponCode: body.couponCode ?? undefined,
      pincode: body.shippingAddress.pincode,
      phone: body.contact.phone,
    });
    if (body.couponCode && evaluation.couponStatus !== 'applied') {
      throw new BadRequestException(evaluation.couponMessage ?? 'Invalid coupon');
    }
    const discountPaisa = evaluation.totalDiscountPaisa;
    const appliedCouponCode = evaluation.couponStatus === 'applied' ? body.couponCode!.toUpperCase() : null;
    const appliedPromotionIds = evaluation.discountLines.map((dl) => dl.promotionId);

    const shippingPaisa = evaluation.freeShipping
      ? 0
      : this.pricing.computeShipping(subtotalPaisa - discountPaisa, shippingCfg);
    const totalPaisa = subtotalPaisa - discountPaisa + shippingPaisa;

    // Lock everything to the DB in one tx — Order/OrderItems, stock decrement,
    // InventoryEvent, coupon usage increment, customer upsert, sequence bump.
    const { order, orderNumber } = await prisma.$transaction(async (tx) => {
      // 1. Stock decrement — conditional update so the OOS race fails with count=0.
      for (const line of lines) {
        const update = await tx.productVariant.updateMany({
          where: {
            id: line.variantId,
            deletedAt: null,
            isActive: true,
            stockCount: { gte: line.quantity },
          },
          data: { stockCount: { decrement: line.quantity } },
        });
        if (update.count === 0) {
          // Re-read the available quantity so the error message is informative.
          const fresh = await tx.productVariant.findUnique({
            where: { id: line.variantId },
            select: { stockCount: true, sku: true },
          });
          throw new ConflictException({
            statusCode: 409,
            reason: 'out_of_stock',
            variantId: line.variantId,
            sku: line.sku,
            available: fresh?.stockCount ?? 0,
            message: `Only ${fresh?.stockCount ?? 0} of ${line.sku} left`,
          });
        }
      }

      // 2. Inventory event per line.
      const customerForActor = await tx.customer.findUnique({
        where: { phone: body.contact.phone },
        select: { id: true },
      });
      for (const line of lines) {
        const before = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          select: { stockCount: true },
        });
        // before is post-decrement — re-derive pre-decrement for the audit row.
        const stockAfter = before!.stockCount;
        const stockBefore = stockAfter + line.quantity;
        await tx.inventoryEvent.create({
          data: {
            variantId: line.variantId,
            changeType: INVENTORY_CHANGE_TYPE.ONLINE_ORDER,
            delta: -line.quantity,
            stockBefore,
            stockAfter,
            actor: ACTOR.CUSTOMER,
            actorId: customerForActor?.id ?? null,
            note: 'Order placement',
          },
        });
      }

      // 3. Upsert customer by phone — needed before commitForOrder so the
      // CouponUsage row gets a customerId when available.
      const customer = await tx.customer.upsert({
        where: { phone: body.contact.phone },
        update: {
          name: body.contact.name,
          email: body.contact.email ?? undefined,
          totalOrders: { increment: 1 },
          totalRevenuePaisa: { increment: totalPaisa },
        },
        create: {
          phone: body.contact.phone,
          name: body.contact.name,
          email: body.contact.email ?? null,
          totalOrders: 1,
          totalRevenuePaisa: totalPaisa,
        },
      });

      // 5. Order number from sequence.
      const orderNumber = await this.numbering.next(tx, 'order');

      // 6. ETA estimate — same window as the storefront serviceability widget.
      const etaFrom = new Date();
      etaFrom.setDate(etaFrom.getDate() + 3);
      const etaTo = new Date();
      etaTo.setDate(etaTo.getDate() + 5);

      // 7. Create order + items. Tracking token is deterministic — sign over the
      // (orderId, phone) pair so the email + success page render the same URL.
      // We don't have orderId until after create, so we generate it post-create and
      // update the row in the same tx.
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          idempotencyKey: body.idempotencyKey,
          state: ORDER_STATE.PAYMENT_PENDING,
          paymentState: PAYMENT_STATE.PENDING,
          subtotalPaisa,
          discountPaisa,
          shippingPaisa,
          taxPaisa,
          totalPaisa,
          appliedCouponCode,
          appliedPromotionIds,
          contactSnapshot: body.contact as unknown as Prisma.InputJsonValue,
          shippingAddressSnapshot: body.shippingAddress as unknown as Prisma.InputJsonValue,
          customerNote: body.customerNote ?? null,
          etaDateFrom: etaFrom,
          etaDateTo: etaTo,
          // Set a placeholder so the unique constraint won't fire on the post-create
          // update. We immediately overwrite with the real token.
          trackingToken: `tmp-${body.idempotencyKey}`,
          items: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              productName: l.productName,
              variantLabel: l.variantLabel,
              sku: l.sku,
              hsnCode: l.hsnCode,
              gstRatePercent: l.gstRatePercent,
              quantity: l.quantity,
              unitPricePaisa: l.unitPricePaisa,
              taxPaisa: l.taxPaisa,
              totalPaisa: l.lineTotalPaisa,
            })),
          },
        },
      });

      const trackingToken = this.tracking.sign(order.id, body.contact.phone);
      const orderWithToken = await tx.order.update({
        where: { id: order.id },
        data: { trackingToken },
      });

      // 8. Commit promotion usage counters + CouponUsage ledger row. Throws
      // 409 with reason 'coupon_limit_reached' if the cap filled between cart
      // evaluation and order placement.
      await this.promotions.commitForOrder(tx, {
        appliedPromotionIds,
        couponCode: appliedCouponCode,
        orderId: order.id,
        customerId: customer.id,
        phone: body.contact.phone,
      });

      return { order: orderWithToken, orderNumber };
    });

    // Order written + stock decremented + counters bumped. Log once with the
    // identifiers an ops person would need to grep for downstream events
    // (payment webhook, transition, etc.). Phone is masked to the last
    // four digits — enough to disambiguate in logs without persisting full
    // PII to wherever container stdout ends up.
    this.logger.log(
      `order created ${orderNumber} total=${order.totalPaisa} discount=${discountPaisa}` +
        ` coupon=${appliedCouponCode ?? '-'} phone=…${body.contact.phone.slice(-4)}`,
    );

    // 8. Create the payment session — outside the tx because some providers issue
    // network calls. The mock provider is synchronous but the interface contract is async.
    let session;
    try {
      session = await this.payments.createSession({
        orderId: order.id,
        orderNumber,
        amountPaisa: order.totalPaisa,
        successRedirectUrl: `/checkout/success/${orderNumber}`,
        customerPhone: body.contact.phone,
      });
    } catch (err) {
      // Payment provider failed AFTER the order row was written. The order
      // sits in payment_pending with no payment session — customer can
      // retry via the same idempotencyKey, which short-circuits to the
      // existing order and creates a fresh session.
      this.logger.error(
        `payment session creation failed for ${orderNumber}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: this.payments.name,
        providerSessionId: session.sessionId,
        amountPaisa: order.totalPaisa,
        status: 'pending',
      },
    });

    return {
      orderId: order.id,
      orderNumber,
      paymentSession: {
        provider: this.payments.name,
        sessionId: session.sessionId,
        redirectUrl: session.redirectUrl,
        amountPaisa: order.totalPaisa,
      },
    };
  }

  // -------- GET /public/orders/:orderNumber --------

  async getOrderByNumber(orderNumber: string): Promise<OrderSnapshot> {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order || order.deletedAt) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }
    return shapeOrder(order);
  }

  // -------- POST /public/payments/webhook/mock --------

  async handleMockWebhook(rawBody: string, signature: string): Promise<{ ok: true }> {
    if (!this.payments.verifyWebhook(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    let parsed: MockWebhookEvent;
    try {
      parsed = JSON.parse(rawBody) as MockWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid webhook body');
    }

    const payment = await prisma.payment.findUnique({
      where: { providerSessionId: parsed.sessionId },
      include: { order: true },
    });
    if (!payment) {
      // Don't 404 — providers retry on non-2xx. Log and ack.
      this.logger.warn(`Webhook for unknown session ${parsed.sessionId}`);
      return { ok: true };
    }

    if (payment.status !== 'pending') {
      // Idempotent — already processed.
      return { ok: true };
    }

    const now = new Date();
    let orderForEmail: OrderSnapshot | null = null;

    if (parsed.status === 'captured') {
      orderForEmail = await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'captured',
            capturedAt: now,
            rawWebhook: { sessionId: parsed.sessionId, status: parsed.status } as Prisma.InputJsonValue,
          },
        });
        const updated = await tx.order.update({
          where: { id: payment.orderId },
          data: {
            state: ORDER_STATE.CONFIRMED,
            paymentState: PAYMENT_STATE.PAID,
            confirmedAt: now,
          },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
        // Drop two timeline rows so the customer + admin both see the transition.
        // payment.captured precedes state.confirmed in time so the order is stable.
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            eventType: ORDER_EVENT_TYPE.PAYMENT_CAPTURED,
            actor: ACTOR.SYSTEM,
            message: 'Payment captured',
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            eventType: ORDER_EVENT_TYPE.STATE_CONFIRMED,
            actor: ACTOR.SYSTEM,
            message: 'Order confirmed',
          },
        });
        return shapeOrder(updated);
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            failedAt: now,
            rawWebhook: { sessionId: parsed.sessionId, status: parsed.status } as Prisma.InputJsonValue,
          },
        });
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            state: ORDER_STATE.PAYMENT_FAILED,
            paymentState: PAYMENT_STATE.FAILED,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            eventType: ORDER_EVENT_TYPE.PAYMENT_FAILED,
            actor: ACTOR.SYSTEM,
            message: 'Payment failed',
          },
        });
      });
    }

    // Always log the outcome — captured + failed are both audit-worthy.
    // payment.orderId resolves to a `${order.orderNumber}` via the include
    // above. The `provider=` field is forward-prep for Sprint 10 when both
    // mock + phonepe paths coexist.
    if (parsed.status === 'captured') {
      this.logger.log(
        `payment captured ${payment.order.orderNumber} provider=${payment.provider} amount=${payment.amountPaisa}`,
      );
    } else {
      this.logger.warn(
        `payment failed ${payment.order.orderNumber} provider=${payment.provider} session=${parsed.sessionId}`,
      );
    }

    // Send the confirmation email outside the tx so a flaky transport doesn't roll back
    // the order. Errors are swallowed by the email service.
    if (orderForEmail && orderForEmail.contact.email) {
      void this.email.sendOrderConfirmation({
        to: orderForEmail.contact.email,
        order: orderForEmail,
      });
    }

    return { ok: true };
  }

  // -------- GET /public/payments/sessions/:sessionId --------

  async getPaymentStatus(sessionId: string): Promise<PaymentStatusResponse> {
    const payment = await prisma.payment.findUnique({
      where: { providerSessionId: sessionId },
      include: { order: { select: { orderNumber: true } } },
    });
    if (!payment) {
      throw new NotFoundException(`Payment session ${sessionId} not found`);
    }
    return {
      sessionId,
      status: payment.status as 'pending' | 'captured' | 'failed',
      orderNumber: payment.order?.orderNumber ?? null,
    };
  }
}

// =====================================================
// Helpers
// =====================================================

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

function shapeOrder(order: OrderWithItems): OrderSnapshot {
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
