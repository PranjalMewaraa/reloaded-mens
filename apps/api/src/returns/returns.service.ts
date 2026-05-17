import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  ACTOR,
  ADMIN_ROLE,
  AUDIT_EVENT_TYPE,
  INVENTORY_CHANGE_TYPE,
  ORDER_EVENT_TYPE,
  ORDER_STATE,
  RESTOCK_DECISION,
  RETURN_STATE,
  RETURN_TYPE,
  type AdminReturnDetail,
  type AdminReturnListItem,
  type AdminReturnListQuery,
  type ApproveReturnRequest,
  type CancelReturnRequest,
  type ContactInfo,
  type CreateReturnRequest,
  type CustomerReturnSummary,
  type MarkReceivedRequest,
  type RejectReturnRequest,
  type ReturnEligibilityResponse,
  type ReturnLineSnapshot,
  type ReturnState,
  type VerifyReturnPayload,
} from '@repo/types';
import { AuditService } from '../audit/audit.service.js';
import { OrderNumberingService } from '../public-checkout/order-numbering.service.js';
import { RefundsService } from '../refunds/refunds.service.js';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.types.js';
import { TrackingTokenService } from '../public-tracking/tracking-token.service.js';
import {
  canCustomerCancel,
  canTransition,
  postApprovalState,
} from './return-state-machine.js';

const DEFAULT_WINDOW_DAYS = 7;
const EXCHANGE_RESERVATION_DAYS = 14;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
]);

@Injectable()
export class ReturnsService {
  constructor(
    private readonly audit: AuditService,
    private readonly numbering: OrderNumberingService,
    private readonly refunds: RefundsService,
    private readonly trackingTokens: TrackingTokenService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // =====================================================
  // Public (token-gated via TrackingTokenService)
  // =====================================================

  async getEligibility(orderNumber: string, token: string): Promise<ReturnEligibilityResponse> {
    const order = await this.assertOrderForToken(orderNumber, token);
    const windowDays = await this.readWindowDays();

    const eligibleNow = isWithinWindow(order.deliveredAt, windowDays);
    const daysRemaining = eligibleNow && order.deliveredAt
      ? Math.max(0, windowDays - daysSince(order.deliveredAt))
      : 0;

    if (!eligibleNow) {
      return {
        orderNumber: order.orderNumber,
        withinWindow: false,
        daysRemaining: 0,
        windowDays,
        items: [],
        openReturnNumber: await this.openReturnNumberForOrder(order.id),
      };
    }

    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
      include: {
        variant: { select: { product: { select: { slug: true } } } },
        returnLineItems: {
          where: {
            returnRequest: {
              state: {
                notIn: [RETURN_STATE.REJECTED, RETURN_STATE.CANCELLED],
              },
            },
          },
          select: { quantity: true },
        },
      },
    });

    const eligibleItems = items
      .map((item) => {
        const bound = item.returnLineItems.reduce((sum, r) => sum + r.quantity, 0);
        const returnableQuantity = Math.max(0, item.quantity - bound);
        return {
          orderItemId: item.id,
          variantId: item.variantId,
          productName: item.productName,
          variantLabel: item.variantLabel,
          sku: item.sku,
          unitPricePaisa: item.unitPricePaisa,
          quantityOrdered: item.quantity,
          returnableQuantity,
          productSlug: item.variant.product.slug,
        };
      })
      .filter((item) => item.returnableQuantity > 0);

    return {
      orderNumber: order.orderNumber,
      withinWindow: true,
      daysRemaining,
      windowDays,
      items: eligibleItems,
      openReturnNumber: await this.openReturnNumberForOrder(order.id),
    };
  }

  async uploadPhoto(
    orderNumber: string,
    token: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ url: string; key: string }> {
    const order = await this.assertOrderForToken(orderNumber, token);
    const windowDays = await this.readWindowDays();
    if (!isWithinWindow(order.deliveredAt, windowDays)) {
      throw new ForbiddenException('Return window has expired');
    }
    if (!file) throw new BadRequestException('No file provided');
    if (file.size <= 0) throw new BadRequestException('Empty file');
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_PHOTO_BYTES / (1024 * 1024)} MB limit`);
    }
    if (!ALLOWED_PHOTO_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Use PNG, JPEG, WebP, or AVIF.`,
      );
    }
    return this.storage.upload({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalName: file.originalname,
      folder: 'returns',
    });
  }

  async createRequest(
    orderNumber: string,
    token: string,
    body: CreateReturnRequest,
  ): Promise<{ returnNumber: string; state: string }> {
    const order = await this.assertOrderForToken(orderNumber, token);
    const windowDays = await this.readWindowDays();
    if (!isWithinWindow(order.deliveredAt, windowDays)) {
      throw new ForbiddenException('Return window has expired');
    }
    // Reject if an open return is already in flight — keeps the queue clean.
    const existing = await this.openReturnNumberForOrder(order.id);
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: `An open return (${existing}) already exists for this order`,
      });
    }

    // Re-fetch OrderItems we'll need + validate eligibility per-line.
    const itemIds = body.items.map((i) => i.orderItemId);
    const orderItems = await prisma.orderItem.findMany({
      where: { id: { in: itemIds }, orderId: order.id },
      include: {
        variant: { select: { productId: true } },
        returnLineItems: {
          where: {
            returnRequest: {
              state: { notIn: [RETURN_STATE.REJECTED, RETURN_STATE.CANCELLED] },
            },
          },
          select: { quantity: true },
        },
      },
    });
    if (orderItems.length !== itemIds.length) {
      throw new BadRequestException('One or more line items do not belong to this order');
    }

    const itemsById = new Map(orderItems.map((i) => [i.id, i]));
    // Validate exchange variants belong to the same product as the original.
    const exchangeVariantIds = body.items
      .filter((i) => i.exchangeVariantId)
      .map((i) => i.exchangeVariantId!);
    const exchangeVariants = exchangeVariantIds.length
      ? await prisma.productVariant.findMany({
          where: { id: { in: exchangeVariantIds }, deletedAt: null, isActive: true },
          select: {
            id: true,
            productId: true,
            size: true,
            color: true,
          },
        })
      : [];
    const exchangeVariantsById = new Map(exchangeVariants.map((v) => [v.id, v]));

    for (const line of body.items) {
      const item = itemsById.get(line.orderItemId);
      if (!item) {
        throw new BadRequestException(`OrderItem ${line.orderItemId} not found`);
      }
      const bound = item.returnLineItems.reduce((sum, r) => sum + r.quantity, 0);
      if (line.quantity > item.quantity - bound) {
        throw new BadRequestException(
          `Requested quantity ${line.quantity} exceeds returnable quantity for ${item.sku}`,
        );
      }
      if (line.action === RETURN_TYPE.EXCHANGE) {
        if (!line.exchangeVariantId) {
          throw new BadRequestException(`Exchange line for ${item.sku} requires exchangeVariantId`);
        }
        const ev = exchangeVariantsById.get(line.exchangeVariantId);
        if (!ev) {
          throw new BadRequestException(`Exchange variant ${line.exchangeVariantId} not found`);
        }
        if (ev.productId !== item.variant.productId) {
          throw new BadRequestException(
            'Exchange variant must belong to the same product as the returned item',
          );
        }
      }
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + EXCHANGE_RESERVATION_DAYS * 24 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const returnNumber = await this.numbering.next(tx, 'return');
      const request = await tx.returnRequest.create({
        data: {
          returnNumber,
          orderId: order.id,
          state: RETURN_STATE.REQUESTED,
          method: body.method,
          customerNote: body.customerNote ?? null,
        },
      });

      for (const line of body.items) {
        const orderItem = itemsById.get(line.orderItemId)!;
        const exchangeVariant = line.exchangeVariantId
          ? exchangeVariantsById.get(line.exchangeVariantId)
          : null;
        const exchangeLabel = exchangeVariant
          ? [exchangeVariant.size, exchangeVariant.color].filter(Boolean).join(' · ') || null
          : null;

        // For exchange + replacement, reserve stock on the chosen variant. Replacement
        // uses the original variantId; exchange uses the chosen exchangeVariantId.
        const reservationTarget =
          line.action === RETURN_TYPE.EXCHANGE
            ? line.exchangeVariantId!
            : line.action === RETURN_TYPE.REPLACEMENT
              ? orderItem.variantId
              : null;
        let reservedUntil: Date | null = null;
        if (reservationTarget) {
          const updated = await tx.productVariant.updateMany({
            where: {
              id: reservationTarget,
              deletedAt: null,
              isActive: true,
              // Free stock = stockCount − reservedForExchange. Postgres can't compare two
              // columns inside updateMany WHERE directly, so we use a raw expression.
            },
            data: { reservedForExchange: { increment: line.quantity } },
          });
          if (updated.count === 0) {
            throw new ConflictException({
              statusCode: 409,
              reason: 'variant_unavailable',
              variantId: reservationTarget,
              message: 'Variant is no longer available for reservation',
            });
          }
          // Now check that the reservation didn't take us past stockCount. Postgres
          // does this with a fresh read because updateMany already committed the
          // increment; if we overshot, roll back via thrown error.
          const fresh = await tx.productVariant.findUnique({
            where: { id: reservationTarget },
            select: { stockCount: true, reservedForExchange: true, sku: true },
          });
          if (!fresh || fresh.reservedForExchange > fresh.stockCount) {
            throw new ConflictException({
              statusCode: 409,
              reason: 'insufficient_exchange_stock',
              variantId: reservationTarget,
              sku: fresh?.sku ?? '',
              message: `Not enough stock to reserve for exchange`,
            });
          }
          reservedUntil = expiry;
        }

        await tx.returnLineItem.create({
          data: {
            returnRequestId: request.id,
            orderItemId: orderItem.id,
            variantId: orderItem.variantId,
            productName: orderItem.productName,
            variantLabel: orderItem.variantLabel,
            sku: orderItem.sku,
            unitPricePaisa: orderItem.unitPricePaisa,
            quantity: line.quantity,
            reason: line.reason,
            reasonNote: line.reasonNote ?? null,
            action: line.action,
            exchangeVariantId: line.exchangeVariantId ?? null,
            exchangeVariantLabel: exchangeLabel,
            photoUrls: line.photoUrls,
            exchangeReservedUntil: reservedUntil,
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: ORDER_EVENT_TYPE.RETURN_REQUESTED,
          message: `Return ${returnNumber} requested`,
          actor: ACTOR.CUSTOMER,
          payload: {
            returnNumber,
            lineCount: body.items.length,
            method: body.method,
          },
        },
      });

      return request;
    });

    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_RETURN_REQUESTED, {
      resource: `order:${order.orderNumber}`,
      payload: { returnNumber: created.returnNumber, lineCount: body.items.length },
    });

    return { returnNumber: created.returnNumber, state: created.state };
  }

  async customerCancel(
    orderNumber: string,
    returnNumber: string,
    token: string,
    body: CancelReturnRequest,
  ): Promise<CustomerReturnSummary> {
    const order = await this.assertOrderForToken(orderNumber, token);
    const returnRequest = await prisma.returnRequest.findFirst({
      where: { returnNumber, orderId: order.id },
    });
    if (!returnRequest) throw new NotFoundException(`Return ${returnNumber} not found`);
    if (!canCustomerCancel(returnRequest.state as ReturnState)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot cancel a return in state "${returnRequest.state}"`,
      });
    }

    await this.applyCancel(
      returnRequest.id,
      body.reason ?? 'Cancelled by customer',
      ACTOR.CUSTOMER,
      null,
    );

    return this.getCustomerSummary(orderNumber, returnNumber, token);
  }

  async getCustomerSummary(
    orderNumber: string,
    returnNumber: string,
    token: string,
  ): Promise<CustomerReturnSummary> {
    const order = await this.assertOrderForToken(orderNumber, token);
    const row = await prisma.returnRequest.findFirst({
      where: { returnNumber, orderId: order.id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException(`Return ${returnNumber} not found`);
    return {
      id: row.id,
      returnNumber: row.returnNumber,
      orderId: row.orderId,
      orderNumber: order.orderNumber,
      state: row.state,
      method: row.method,
      customerNote: row.customerNote,
      rejectedReason: row.rejectedReason,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      pickupScheduledAt: row.pickupScheduledAt?.toISOString() ?? null,
      receivedAt: row.receivedAt?.toISOString() ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      items: row.items.map(shapeLine),
      canCustomerCancel: canCustomerCancel(row.state as ReturnState),
    };
  }

  // =====================================================
  // Admin
  // =====================================================

  async list(query: AdminReturnListQuery): Promise<{
    items: AdminReturnListItem[];
    page: number;
    limit: number;
    total: number;
  }> {
    const where: Prisma.ReturnRequestWhereInput = {};
    if (query.state) where.state = query.state;
    const [total, rows] = await Promise.all([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          order: { select: { orderNumber: true, contactSnapshot: true } },
          items: {
            select: { photoUrls: true, productName: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);
    return {
      items: rows.map((r) => {
        const contact = (r.order.contactSnapshot as unknown as ContactInfo | null) ?? null;
        const primaryPhotoUrls = r.items
          .flatMap((i) => i.photoUrls)
          .slice(0, 3);
        return {
          id: r.id,
          returnNumber: r.returnNumber,
          orderNumber: r.order.orderNumber,
          customerName: contact?.name ?? 'Unknown',
          state: r.state,
          method: r.method,
          itemCount: r.items.length,
          primaryPhotoUrls,
          createdAt: r.createdAt.toISOString(),
        };
      }),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async getDetail(idOrNumber: string): Promise<AdminReturnDetail> {
    const row = await prisma.returnRequest.findFirst({
      where: { OR: [{ id: idOrNumber }, { returnNumber: idOrNumber }] },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        order: { select: { orderNumber: true, contactSnapshot: true } },
        refundRequest: { select: { refundNumber: true } },
      },
    });
    if (!row) throw new NotFoundException(`Return ${idOrNumber} not found`);
    const contact = (row.order.contactSnapshot as unknown as ContactInfo | null) ?? null;
    return {
      id: row.id,
      returnNumber: row.returnNumber,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      state: row.state,
      method: row.method,
      customerNote: row.customerNote,
      rejectedReason: row.rejectedReason,
      internalNote: row.internalNote,
      refundRequestId: row.refundRequestId,
      refundRequestNumber: row.refundRequest?.refundNumber ?? null,
      customerName: contact?.name ?? 'Unknown',
      customerPhone: contact?.phone ?? '',
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      pickupScheduledAt: row.pickupScheduledAt?.toISOString() ?? null,
      receivedAt: row.receivedAt?.toISOString() ?? null,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      items: row.items.map(shapeLine),
    };
  }

  async approve(
    idOrNumber: string,
    body: ApproveReturnRequest,
    actor: { id: string; role: string },
  ): Promise<AdminReturnDetail> {
    const row = await this.requireReturn(idOrNumber);
    if (!canTransition(row.state as ReturnState, RETURN_STATE.APPROVED)) {
      throw new BadRequestException(`Cannot approve a return in state "${row.state}"`);
    }
    const hasSchedule = Boolean(body.pickupScheduledAt);
    const target = hasSchedule
      ? postApprovalState(row.method, true)
      : postApprovalState(row.method, false);

    await prisma.$transaction(async (tx) => {
      const data: Prisma.ReturnRequestUpdateInput = {
        state: target,
        approvedAt: new Date(),
      };
      if (body.internalNote !== undefined) data.internalNote = body.internalNote;
      if (target === RETURN_STATE.PICKUP_SCHEDULED && body.pickupScheduledAt) {
        data.pickupScheduledAt = new Date(body.pickupScheduledAt);
      }
      await tx.returnRequest.update({ where: { id: row.id }, data });

      await tx.orderEvent.create({
        data: {
          orderId: row.orderId,
          eventType:
            target === RETURN_STATE.PICKUP_SCHEDULED
              ? ORDER_EVENT_TYPE.RETURN_PICKUP_SCHEDULED
              : ORDER_EVENT_TYPE.RETURN_APPROVED,
          message: target === RETURN_STATE.PICKUP_SCHEDULED ? 'Return pickup scheduled' : 'Return approved',
          actor: actorOf(actor.role),
          actorId: actor.id,
          payload: { returnNumber: row.returnNumber },
        },
      });
    });

    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_RETURN_APPROVED, {
      adminUserId: actor.id,
      resource: `return:${row.returnNumber}`,
      payload: { state: target },
    });
    return this.getDetail(row.id);
  }

  async reject(
    idOrNumber: string,
    body: RejectReturnRequest,
    actor: { id: string; role: string },
  ): Promise<AdminReturnDetail> {
    const row = await this.requireReturn(idOrNumber);
    if (!canTransition(row.state as ReturnState, RETURN_STATE.REJECTED)) {
      throw new BadRequestException(`Cannot reject a return in state "${row.state}"`);
    }

    await this.applyTerminalRelease(row.id, RETURN_STATE.REJECTED, body.reason, actor);
    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_RETURN_REJECTED, {
      adminUserId: actor.id,
      resource: `return:${row.returnNumber}`,
      payload: { reason: body.reason },
    });
    return this.getDetail(row.id);
  }

  async markReceived(
    idOrNumber: string,
    body: MarkReceivedRequest,
    actor: { id: string; role: string },
  ): Promise<AdminReturnDetail> {
    const row = await this.requireReturn(idOrNumber);
    if (!canTransition(row.state as ReturnState, RETURN_STATE.RECEIVED)) {
      throw new BadRequestException(`Cannot mark received from state "${row.state}"`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: row.id },
        data: { state: RETURN_STATE.RECEIVED, receivedAt: new Date() },
      });
      await tx.orderEvent.create({
        data: {
          orderId: row.orderId,
          eventType: ORDER_EVENT_TYPE.RETURN_RECEIVED,
          message: body.note ?? 'Return received',
          actor: actorOf(actor.role),
          actorId: actor.id,
          payload: { returnNumber: row.returnNumber },
        },
      });
    });
    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_RETURN_RECEIVED, {
      adminUserId: actor.id,
      resource: `return:${row.returnNumber}`,
      payload: { note: body.note ?? null },
    });
    return this.getDetail(row.id);
  }

  async verify(
    idOrNumber: string,
    body: VerifyReturnPayload,
    actor: { id: string; role: string },
  ): Promise<AdminReturnDetail> {
    const row = await this.requireReturn(idOrNumber);
    if (!canTransition(row.state as ReturnState, RETURN_STATE.VERIFIED)) {
      throw new BadRequestException(`Cannot verify a return in state "${row.state}"`);
    }
    const lineDecisionsById = new Map(body.lines.map((l) => [l.returnLineItemId, l]));
    const items = await prisma.returnLineItem.findMany({
      where: { returnRequestId: row.id },
    });
    // Make sure the payload covers every line so nothing is left in 'pending'.
    for (const line of items) {
      if (!lineDecisionsById.has(line.id)) {
        throw new BadRequestException(`Missing verification decision for line ${line.id}`);
      }
    }

    let refundAmountPaisa = 0;
    const refundLines: typeof items = [];
    for (const line of items) {
      if (line.action === RETURN_TYPE.RETURN) {
        refundAmountPaisa += line.unitPricePaisa * line.quantity;
        refundLines.push(line);
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const line of items) {
        const decision = lineDecisionsById.get(line.id)!;
        await tx.returnLineItem.update({
          where: { id: line.id },
          data: {
            verifiedCondition: decision.verifiedCondition,
            restockDecision: decision.restockDecision,
          },
        });
        if (decision.restockDecision === RESTOCK_DECISION.RESTOCK) {
          const updated = await tx.productVariant.update({
            where: { id: line.variantId },
            data: { stockCount: { increment: line.quantity } },
            select: { stockCount: true },
          });
          await tx.inventoryEvent.create({
            data: {
              variantId: line.variantId,
              changeType: INVENTORY_CHANGE_TYPE.RETURN_RESTOCK,
              delta: line.quantity,
              stockBefore: updated.stockCount - line.quantity,
              stockAfter: updated.stockCount,
              actor: actorOf(actor.role),
              actorId: actor.id,
              referenceId: row.orderId,
              note: `Return ${row.returnNumber} verified — restocked`,
            },
          });
        } else if (decision.restockDecision === RESTOCK_DECISION.DAMAGE_WRITEOFF) {
          // Stock unchanged — unit was decremented at order placement and isn't
          // coming back. Just write the audit event.
          const current = await tx.productVariant.findUnique({
            where: { id: line.variantId },
            select: { stockCount: true },
          });
          await tx.inventoryEvent.create({
            data: {
              variantId: line.variantId,
              changeType: INVENTORY_CHANGE_TYPE.WRITE_OFF,
              delta: 0,
              stockBefore: current?.stockCount ?? 0,
              stockAfter: current?.stockCount ?? 0,
              actor: actorOf(actor.role),
              actorId: actor.id,
              referenceId: row.orderId,
              note: `Return ${row.returnNumber} verified — damaged write-off`,
            },
          });
        }
      }

      const data: Prisma.ReturnRequestUpdateInput = {
        state: RETURN_STATE.VERIFIED,
        verifiedAt: new Date(),
      };
      if (body.internalNote !== undefined) data.internalNote = body.internalNote;
      await tx.returnRequest.update({ where: { id: row.id }, data });

      await tx.orderEvent.create({
        data: {
          orderId: row.orderId,
          eventType: ORDER_EVENT_TYPE.RETURN_VERIFIED,
          message: 'Return verified',
          actor: actorOf(actor.role),
          actorId: actor.id,
          payload: { returnNumber: row.returnNumber },
        },
      });
    });
    // Refund creation runs outside the verification tx so we can reuse
    // RefundsService.create() — it has its own tx + auditing and we don't want a
    // refund insert failure to roll back the verification itself.

    let refundCreatedNumber: string | null = null;
    if (body.triggerRefund && refundAmountPaisa > 0 && refundLines.length > 0) {
      try {
        const refund = await this.refunds.create(
          {
            orderId: row.orderId,
            amountPaisa: refundAmountPaisa,
            reason: `Return ${row.returnNumber} verified`,
          },
          { id: actor.id, role: actor.role },
        );
        refundCreatedNumber = refund.refundNumber;
        await prisma.returnRequest.update({
          where: { id: row.id },
          data: { refundRequestId: refund.id },
        });
      } catch (err) {
        // Refund failed (e.g. order already refunded) — don't roll back the
        // verification. Log + carry on. Sprint 17 swaps console.warn for the
        // real logger.
        console.warn(
          `[returns] verify ${row.returnNumber} succeeded but refund creation failed: ${(err as Error).message}`,
        );
      }
    }

    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_RETURN_VERIFIED, {
      adminUserId: actor.id,
      resource: `return:${row.returnNumber}`,
      payload: {
        refundAmountPaisa,
        refundCreatedNumber,
      },
    });
    return this.getDetail(row.id);
  }

  async markCompleted(
    idOrNumber: string,
    actor: { id: string; role: string },
  ): Promise<AdminReturnDetail> {
    const row = await this.requireReturn(idOrNumber);
    if (!canTransition(row.state as ReturnState, RETURN_STATE.COMPLETED)) {
      throw new BadRequestException(`Cannot complete a return in state "${row.state}"`);
    }
    const items = await prisma.returnLineItem.findMany({ where: { returnRequestId: row.id } });
    await prisma.$transaction(async (tx) => {
      // Release any exchange/replacement reservations now that the replacement shipped.
      for (const line of items) {
        const reservationTarget =
          line.action === RETURN_TYPE.EXCHANGE
            ? line.exchangeVariantId
            : line.action === RETURN_TYPE.REPLACEMENT
              ? line.variantId
              : null;
        if (reservationTarget) {
          await tx.productVariant.update({
            where: { id: reservationTarget },
            data: { reservedForExchange: { decrement: line.quantity } },
          });
          await tx.returnLineItem.update({
            where: { id: line.id },
            data: { exchangeReservedUntil: null },
          });
        }
      }
      await tx.returnRequest.update({
        where: { id: row.id },
        data: { state: RETURN_STATE.COMPLETED, completedAt: new Date() },
      });
      await tx.orderEvent.create({
        data: {
          orderId: row.orderId,
          eventType: ORDER_EVENT_TYPE.RETURN_COMPLETED,
          message: 'Return completed',
          actor: actorOf(actor.role),
          actorId: actor.id,
          payload: { returnNumber: row.returnNumber },
        },
      });
    });
    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_RETURN_COMPLETED, {
      adminUserId: actor.id,
      resource: `return:${row.returnNumber}`,
    });
    return this.getDetail(row.id);
  }

  async adminCancel(
    idOrNumber: string,
    reason: string,
    actor: { id: string; role: string },
  ): Promise<AdminReturnDetail> {
    const row = await this.requireReturn(idOrNumber);
    if (!canTransition(row.state as ReturnState, RETURN_STATE.CANCELLED)) {
      throw new BadRequestException(`Cannot cancel a return in state "${row.state}"`);
    }
    await this.applyTerminalRelease(row.id, RETURN_STATE.CANCELLED, reason, actor);
    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_RETURN_CANCELLED, {
      adminUserId: actor.id,
      resource: `return:${row.returnNumber}`,
      payload: { reason },
    });
    return this.getDetail(row.id);
  }

  async updateInternalNote(
    idOrNumber: string,
    note: string,
    actor: { id: string; role: string },
  ): Promise<AdminReturnDetail> {
    const row = await this.requireReturn(idOrNumber);
    await prisma.returnRequest.update({
      where: { id: row.id },
      data: { internalNote: note.trim().length === 0 ? null : note },
    });
    await this.audit.write(AUDIT_EVENT_TYPE.ORDER_NOTE_UPDATED, {
      adminUserId: actor.id,
      resource: `return:${row.returnNumber}`,
      payload: { length: note.length },
    });
    return this.getDetail(row.id);
  }

  // =====================================================
  // Shared internals
  // =====================================================

  private async applyCancel(
    returnRequestId: string,
    reason: string,
    actor: 'customer' | 'staff' | 'admin',
    actorId: string | null,
  ) {
    const row = await prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
    });
    if (!row) throw new NotFoundException(`Return ${returnRequestId} not found`);
    if (!canTransition(row.state as ReturnState, RETURN_STATE.CANCELLED)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot cancel a return in state "${row.state}"`,
      });
    }
    await this.applyTerminalRelease(returnRequestId, RETURN_STATE.CANCELLED, reason, {
      id: actorId ?? '',
      role: actor === ACTOR.CUSTOMER ? 'customer' : actor,
    });
  }

  private async applyTerminalRelease(
    returnRequestId: string,
    targetState: ReturnState,
    reason: string,
    actor: { id: string; role: string },
  ): Promise<void> {
    const row = await prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { items: true },
    });
    if (!row) throw new NotFoundException(`Return ${returnRequestId} not found`);

    await prisma.$transaction(async (tx) => {
      // Release any exchange/replacement reservations.
      for (const line of row.items) {
        if (!line.exchangeReservedUntil) continue;
        const reservationTarget =
          line.action === RETURN_TYPE.EXCHANGE
            ? line.exchangeVariantId
            : line.action === RETURN_TYPE.REPLACEMENT
              ? line.variantId
              : null;
        if (!reservationTarget) continue;
        await tx.productVariant.update({
          where: { id: reservationTarget },
          data: { reservedForExchange: { decrement: line.quantity } },
        });
        await tx.returnLineItem.update({
          where: { id: line.id },
          data: { exchangeReservedUntil: null },
        });
      }

      const data: Prisma.ReturnRequestUpdateInput = { state: targetState };
      if (targetState === RETURN_STATE.REJECTED) {
        data.rejectedAt = new Date();
        data.rejectedReason = reason;
      } else if (targetState === RETURN_STATE.CANCELLED) {
        data.cancelledAt = new Date();
        data.rejectedReason = reason;
      }
      await tx.returnRequest.update({ where: { id: row.id }, data });

      await tx.orderEvent.create({
        data: {
          orderId: row.orderId,
          eventType:
            targetState === RETURN_STATE.REJECTED
              ? ORDER_EVENT_TYPE.RETURN_REJECTED
              : ORDER_EVENT_TYPE.RETURN_CANCELLED,
          message: reason,
          actor: actor.role === 'customer' ? ACTOR.CUSTOMER : actorOf(actor.role),
          actorId: actor.id || null,
          payload: { returnNumber: row.returnNumber, reason },
        },
      });
    });
  }

  private async readWindowDays(): Promise<number> {
    const row = await prisma.setting.findUnique({
      where: { key: 'returns.window_days' },
    });
    if (!row) return DEFAULT_WINDOW_DAYS;
    if (typeof row.value === 'number') return Math.max(0, Math.floor(row.value));
    if (typeof row.value === 'string') {
      const n = Number.parseInt(row.value, 10);
      return Number.isFinite(n) ? Math.max(0, n) : DEFAULT_WINDOW_DAYS;
    }
    return DEFAULT_WINDOW_DAYS;
  }

  private async openReturnNumberForOrder(orderId: string): Promise<string | null> {
    const open = await prisma.returnRequest.findFirst({
      where: {
        orderId,
        state: { notIn: [RETURN_STATE.REJECTED, RETURN_STATE.CANCELLED, RETURN_STATE.COMPLETED] },
      },
      select: { returnNumber: true },
      orderBy: { createdAt: 'desc' },
    });
    return open?.returnNumber ?? null;
  }

  private async assertOrderForToken(orderNumber: string, token: string) {
    if (!token) throw new UnauthorizedException('Missing tracking token');
    const order = await prisma.order.findFirst({
      where: { orderNumber, deletedAt: null },
      select: {
        id: true,
        orderNumber: true,
        state: true,
        deliveredAt: true,
        trackingToken: true,
        contactSnapshot: true,
      },
    });
    if (!order) throw new NotFoundException(`Order ${orderNumber} not found`);
    if (!order.trackingToken || !this.trackingTokens.verify(order.trackingToken, token)) {
      throw new UnauthorizedException('Invalid tracking token');
    }
    if (order.state !== ORDER_STATE.DELIVERED) {
      throw new ForbiddenException('Only delivered orders are eligible for returns');
    }
    return order;
  }

  private async requireReturn(idOrNumber: string) {
    const row = await prisma.returnRequest.findFirst({
      where: { OR: [{ id: idOrNumber }, { returnNumber: idOrNumber }] },
    });
    if (!row) throw new NotFoundException(`Return ${idOrNumber} not found`);
    return row;
  }
}

// =====================================================
// Helpers
// =====================================================

function shapeLine(line: Prisma.ReturnLineItemGetPayload<Record<string, never>>): ReturnLineSnapshot {
  return {
    id: line.id,
    orderItemId: line.orderItemId,
    variantId: line.variantId,
    productName: line.productName,
    variantLabel: line.variantLabel,
    sku: line.sku,
    unitPricePaisa: line.unitPricePaisa,
    quantity: line.quantity,
    reason: line.reason,
    reasonNote: line.reasonNote,
    action: line.action,
    exchangeVariantId: line.exchangeVariantId,
    exchangeVariantLabel: line.exchangeVariantLabel,
    verifiedCondition: line.verifiedCondition,
    restockDecision: line.restockDecision,
    photoUrls: line.photoUrls,
    exchangeReservedUntil: line.exchangeReservedUntil?.toISOString() ?? null,
  };
}

function actorOf(role: string): 'admin' | 'staff' | 'system' {
  if (role === ADMIN_ROLE.ADMIN) return ACTOR.ADMIN;
  if (role === ADMIN_ROLE.STAFF) return ACTOR.STAFF;
  return ACTOR.SYSTEM;
}

function isWithinWindow(deliveredAt: Date | null, windowDays: number): boolean {
  if (!deliveredAt) return false;
  return daysSince(deliveredAt) <= windowDays;
}

function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
