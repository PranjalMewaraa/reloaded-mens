import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  AUDIT_EVENT_TYPE,
  COUPON_STATUS,
  PROMOTION_SOURCE,
  promotionActionSchema,
  promotionConditionSchema,
  type CartEvaluateDiscountLine,
  type CartEvaluateRequest,
  type CartEvaluateResponse,
  type CouponStatus,
  type CouponSummary,
  type CreatePromotionRequest,
  type GenerateCouponsRequest,
  type PromotionAction,
  type PromotionCondition,
  type PromotionDetail,
  type PromotionListQuery,
  type PromotionSummary,
  type SingleCouponCreate,
  type UpdatePromotionRequest,
} from '@repo/types';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { evaluateCart as evalEngine } from './engine/evaluate.js';
import type { CartLineCtx, PromotionRule } from './engine/types.js';

interface ActorRef {
  id: string;
}

const FREE_SHIPPING_FALLBACK_THRESHOLD_PAISA = 199900;
const FLAT_SHIPPING_PAISA = 9900;

@Injectable()
export class PromotionsService {
  constructor(private readonly audit: AuditService) {}

  // =====================================================
  // Admin CRUD
  // =====================================================

  async list(query: PromotionListQuery): Promise<{ items: PromotionSummary[]; total: number; page: number; limit: number }> {
    const where: Prisma.PromotionWhereInput = {};
    if (typeof query.isAutomatic === 'boolean') where.isAutomatic = query.isAutomatic;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { coupons: true } } },
      }),
      prisma.promotion.count({ where }),
    ]);
    return {
      items: rows.map((p) => shapePromotionSummary(p, p._count.coupons)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getById(id: string): Promise<PromotionDetail> {
    const promo = await prisma.promotion.findUnique({
      where: { id },
      include: {
        coupons: { orderBy: { createdAt: 'desc' }, take: 100 },
        _count: { select: { coupons: true } },
      },
    });
    if (!promo) throw new NotFoundException(`Promotion ${id} not found`);
    return shapePromotionDetail(promo);
  }

  async create(input: CreatePromotionRequest, actor: ActorRef): Promise<PromotionDetail> {
    const created = await prisma.promotion.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        isAutomatic: input.isAutomatic,
        isActive: input.isActive,
        stackable: input.stackable,
        stackPriority: input.stackPriority,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
        conditions: input.conditions as unknown as Prisma.InputJsonValue,
        actions: input.actions as unknown as Prisma.InputJsonValue,
      },
      include: {
        coupons: { orderBy: { createdAt: 'desc' }, take: 100 },
        _count: { select: { coupons: true } },
      },
    });
    await this.audit.write(AUDIT_EVENT_TYPE.PROMOTION_CREATED, {
      adminUserId: actor.id,
      resource: `promotion:${created.id}`,
      payload: { name: created.name, isAutomatic: created.isAutomatic },
    });
    return shapePromotionDetail(created);
  }

  async update(id: string, input: UpdatePromotionRequest, actor: ActorRef): Promise<PromotionDetail> {
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Promotion ${id} not found`);

    const data: Prisma.PromotionUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.isAutomatic !== undefined) data.isAutomatic = input.isAutomatic;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.stackable !== undefined) data.stackable = input.stackable;
    if (input.stackPriority !== undefined) data.stackPriority = input.stackPriority;
    if (input.validFrom !== undefined) data.validFrom = input.validFrom ? new Date(input.validFrom) : null;
    if (input.validTo !== undefined) data.validTo = input.validTo ? new Date(input.validTo) : null;
    if (input.conditions !== undefined) data.conditions = input.conditions as unknown as Prisma.InputJsonValue;
    if (input.actions !== undefined) data.actions = input.actions as unknown as Prisma.InputJsonValue;

    const updated = await prisma.promotion.update({
      where: { id },
      data,
      include: {
        coupons: { orderBy: { createdAt: 'desc' }, take: 100 },
        _count: { select: { coupons: true } },
      },
    });
    await this.audit.write(AUDIT_EVENT_TYPE.PROMOTION_UPDATED, {
      adminUserId: actor.id,
      resource: `promotion:${id}`,
      payload: { changes: Object.keys(data) },
    });
    return shapePromotionDetail(updated);
  }

  async delete(id: string, actor: ActorRef): Promise<{ ok: true; hard: boolean }> {
    const promo = await prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException(`Promotion ${id} not found`);
    const hard = promo.usageCount === 0;
    if (hard) {
      await prisma.promotion.delete({ where: { id } });
    } else {
      await prisma.promotion.update({ where: { id }, data: { isActive: false } });
    }
    await this.audit.write(AUDIT_EVENT_TYPE.PROMOTION_DELETED, {
      adminUserId: actor.id,
      resource: `promotion:${id}`,
      payload: { hard, name: promo.name },
    });
    return { ok: true, hard };
  }

  // =====================================================
  // Coupon CRUD
  // =====================================================

  async listCoupons(
    promotionId: string,
    query: { page: number; limit: number; batch?: string },
  ): Promise<{ items: CouponSummary[]; total: number; page: number; limit: number }> {
    const where: Prisma.CouponWhereInput = { promotionId };
    if (query.batch) where.batchLabel = query.batch;
    const [rows, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.coupon.count({ where }),
    ]);
    return {
      items: rows.map(shapeCoupon),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async createCoupon(promotionId: string, input: SingleCouponCreate, actor: ActorRef): Promise<CouponSummary> {
    const promo = await prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promo) throw new NotFoundException(`Promotion ${promotionId} not found`);
    if (promo.isAutomatic) {
      throw new BadRequestException('Automatic promotions cannot have coupons');
    }
    try {
      const created = await prisma.coupon.create({
        data: {
          code: input.code,
          promotionId,
          usageLimitTotal: input.usageLimitTotal,
          usageLimitPerCustomer: input.usageLimitPerCustomer,
          batchLabel: input.batchLabel ?? null,
        },
      });
      await this.audit.write(AUDIT_EVENT_TYPE.COUPON_CREATED, {
        adminUserId: actor.id,
        resource: `coupon:${created.id}`,
        payload: { code: created.code, promotionId },
      });
      return shapeCoupon(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ message: `Coupon code ${input.code} already exists`, reason: 'code_taken' });
      }
      throw err;
    }
  }

  async deactivateCoupon(couponId: string, actor: ActorRef): Promise<CouponSummary> {
    const updated = await prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: false },
    });
    await this.audit.write(AUDIT_EVENT_TYPE.COUPON_DEACTIVATED, {
      adminUserId: actor.id,
      resource: `coupon:${couponId}`,
      payload: { code: updated.code },
    });
    return shapeCoupon(updated);
  }

  async generateCoupons(
    promotionId: string,
    input: GenerateCouponsRequest,
    actor: ActorRef,
  ): Promise<{ generated: CouponSummary[]; batchLabel: string | null }> {
    const promo = await prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promo) throw new NotFoundException(`Promotion ${promotionId} not found`);
    if (promo.isAutomatic) {
      throw new BadRequestException('Automatic promotions cannot have coupons');
    }

    const batchLabel = input.batchLabel ?? null;
    const generated: CouponSummary[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < input.count; i++) {
      let attempts = 0;
      while (attempts < 6) {
        const code = generateCode(input.prefix, input.length);
        if (seen.has(code)) {
          attempts += 1;
          continue;
        }
        seen.add(code);
        try {
          const row = await prisma.coupon.create({
            data: {
              code,
              promotionId,
              usageLimitTotal: input.usageLimitTotal,
              usageLimitPerCustomer: input.usageLimitPerCustomer,
              batchLabel,
            },
          });
          generated.push(shapeCoupon(row));
          break;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            attempts += 1;
            continue;
          }
          throw err;
        }
      }
      if (attempts >= 6) {
        throw new ConflictException({
          message: 'Could not generate a unique coupon code after multiple attempts',
          reason: 'code_collision',
        });
      }
    }

    await this.audit.write(AUDIT_EVENT_TYPE.COUPONS_BULK_GENERATED, {
      adminUserId: actor.id,
      resource: `promotion:${promotionId}`,
      payload: { count: generated.length, batchLabel },
    });
    return { generated, batchLabel };
  }

  // =====================================================
  // Cart evaluation
  // =====================================================

  /**
   * Evaluate a cart payload — load variants, fetch active promotions, optionally
   * resolve a coupon, and return the discount stack. Used by both the
   * /public/cart/evaluate endpoint and the order create flow (server-side
   * re-evaluation so we never trust the client's math).
   */
  async evaluate(input: CartEvaluateRequest): Promise<CartEvaluateResponse> {
    const variantIds = input.lines.map((l) => l.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null, isActive: true },
      include: {
        product: {
          select: {
            id: true,
            basePricePaisa: true,
            isActive: true,
            deletedAt: true,
            productCategories: { select: { categoryId: true } },
          },
        },
      },
    });
    if (variants.length !== variantIds.length) {
      throw new BadRequestException('One or more cart items are no longer available');
    }

    const lineCtxs: CartLineCtx[] = input.lines.map((line) => {
      const variant = variants.find((v) => v.id === line.variantId)!;
      if (!variant.product.isActive || variant.product.deletedAt) {
        throw new BadRequestException('One or more products are no longer available');
      }
      const unitPricePaisa = variant.priceOverridePaisa ?? variant.product.basePricePaisa;
      return {
        variantId: variant.id,
        productId: variant.product.id,
        categoryIds: variant.product.productCategories.map((pc) => pc.categoryId),
        quantity: line.quantity,
        unitPricePaisa,
        lineSubtotalPaisa: unitPricePaisa * line.quantity,
      };
    });

    const subtotalPaisa = lineCtxs.reduce((s, l) => s + l.lineSubtotalPaisa, 0);

    // First-time customer check — only run when phone is supplied. Otherwise
    // the engine treats it as null (fail open at the cart, fail closed at order).
    //
    // Only count "paid-or-better" states so a customer whose first checkout was
    // cancelled / payment_failed isn't unfairly bumped out of first-order
    // promos when they retry. payment_pending also excluded — until payment
    // captures, the order shouldn't count.
    let isFirstTimeCustomer: boolean | null = null;
    if (input.phone) {
      const existingCount = await prisma.order.count({
        where: {
          contactSnapshot: { path: ['phone'], equals: input.phone },
          state: { in: ['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'] },
        },
      });
      isFirstTimeCustomer = existingCount === 0;
    }

    // Resolve customerId from phone for the per-customer cap check inside
    // lookupCoupon. cart-evaluate is an unauthenticated endpoint, so we infer
    // the customer rather than reading from a session — keeps the cap check
    // consistent with commitForOrder, which uses customerId OR phone.
    let customerId: string | null = null;
    if (input.phone) {
      const customer = await prisma.customer.findUnique({
        where: { phone: input.phone },
        select: { id: true },
      });
      customerId = customer?.id ?? null;
    }

    const automaticPromotions = await this.findActiveAutomaticPromotions();

    let couponPromotion: PromotionRule | null = null;
    let couponStatus: CouponStatus = COUPON_STATUS.NONE;
    let couponMessage: string | null = null;
    let redeemedCouponCode: string | null = null;
    if (input.couponCode) {
      const lookup = await this.lookupCoupon(input.couponCode, {
        phone: input.phone,
        customerId,
      });
      couponStatus = lookup.status;
      couponMessage = lookup.message;
      if (lookup.status === COUPON_STATUS.APPLIED && lookup.promotionRule) {
        couponPromotion = lookup.promotionRule;
        redeemedCouponCode = input.couponCode;
      }
    }

    const evalResult = evalEngine(
      { lines: lineCtxs, pincode: input.pincode, phone: input.phone },
      { isFirstTimeCustomer },
      { automatic: automaticPromotions, coupon: couponPromotion },
    );

    // If the coupon's promotion got filtered out by conditions, downgrade status.
    if (couponPromotion && !evalResult.appliedPromotionIds.includes(couponPromotion.id)) {
      couponStatus = COUPON_STATUS.WRONG_CART;
      couponMessage = "This code doesn't apply to your cart.";
      redeemedCouponCode = null;
    }

    // Shipping fee derivation — flat fallback. The order-create flow re-runs
    // PricingService to get the canonical number; cart-evaluate uses the same
    // threshold purely for display.
    const subtotalAfterDiscount = Math.max(0, subtotalPaisa - evalResult.totalDiscountPaisa);
    const shippingPaisa = evalResult.freeShipping || subtotalAfterDiscount >= FREE_SHIPPING_FALLBACK_THRESHOLD_PAISA
      ? 0
      : FLAT_SHIPPING_PAISA;

    const discountLines: CartEvaluateDiscountLine[] = evalResult.discountLines.map((dl) => ({
      promotionId: dl.promotionId,
      promotionName: dl.promotionName,
      source: dl.source === 'coupon' ? PROMOTION_SOURCE.COUPON : PROMOTION_SOURCE.AUTOMATIC,
      couponCode: dl.source === 'coupon' ? redeemedCouponCode : null,
      amountPaisa: dl.amountPaisa,
      description: dl.description,
    }));

    return {
      subtotalPaisa,
      shippingPaisa,
      discountLines,
      totalDiscountPaisa: evalResult.totalDiscountPaisa,
      totalPaisa: subtotalAfterDiscount + shippingPaisa,
      freeShipping: evalResult.freeShipping || shippingPaisa === 0,
      couponStatus,
      couponMessage,
    };
  }

  // =====================================================
  // Order placement integration
  // =====================================================

  /**
   * Atomically apply usage increments inside a transaction. Returns the
   * promotion ids stamped on the order and the coupon row (if any) to write
   * a CouponUsage ledger entry against.
   *
   * Called by PublicCheckoutService.createOrder inside its tx after stock
   * decrement. Throws ConflictException with reason: 'coupon_limit_reached'
   * if a per-customer/total cap was hit since cart-evaluate ran.
   */
  async commitForOrder(
    tx: Prisma.TransactionClient,
    args: {
      appliedPromotionIds: string[];
      couponCode: string | null;
      orderId: string;
      customerId: string | null;
      phone: string;
    },
  ): Promise<{ couponId: string | null }> {
    let couponId: string | null = null;

    if (args.couponCode) {
      // Normalise to match lookupCoupon — storage is uppercase, callers may
      // not be. Identical handling at both points avoids the case where
      // cart-evaluate accepted a code and commit silently 404s on it.
      const normalisedCode = args.couponCode.trim().toUpperCase();
      const coupon = await tx.coupon.findUnique({
        where: { code: normalisedCode },
        include: { promotion: true },
      });
      if (!coupon || !coupon.isActive || !coupon.promotion.isActive) {
        throw new ConflictException({ reason: 'coupon_limit_reached', message: 'Coupon no longer redeemable' });
      }
      // Total cap check (atomic via conditional update below).
      const bumpResult = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          isActive: true,
          OR: [
            { usageLimitTotal: 0 },
            { usageLimitTotal: { gt: 0 }, usageCount: { lt: coupon.usageLimitTotal || Number.MAX_SAFE_INTEGER } },
          ],
        },
        data: { usageCount: { increment: 1 } },
      });
      if (bumpResult.count === 0) {
        throw new ConflictException({ reason: 'coupon_limit_reached', message: 'Coupon usage limit reached' });
      }
      // Per-customer cap.
      if (coupon.usageLimitPerCustomer > 0) {
        const customerCount = await tx.couponUsage.count({
          where: {
            couponId: coupon.id,
            OR: [
              args.customerId ? { customerId: args.customerId } : { customerId: '__never__' },
              { phone: args.phone },
            ],
          },
        });
        if (customerCount >= coupon.usageLimitPerCustomer) {
          throw new ConflictException({
            reason: 'coupon_limit_reached',
            message: 'You have already used this coupon',
          });
        }
      }
      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          customerId: args.customerId,
          phone: args.phone,
          orderId: args.orderId,
        },
      });
      couponId = coupon.id;
    }

    if (args.appliedPromotionIds.length > 0) {
      await tx.promotion.updateMany({
        where: { id: { in: args.appliedPromotionIds } },
        data: { usageCount: { increment: 1 } },
      });
    }

    return { couponId };
  }

  // =====================================================
  // Internal — coupon lookup with full validation
  // =====================================================

  private async lookupCoupon(
    code: string,
    ctx: { phone?: string; customerId?: string | null },
  ): Promise<{ status: CouponStatus; message: string | null; promotionRule: PromotionRule | null }> {
    // Normalise the user-supplied code BEFORE lookup. Schema stores codes
    // uppercase (see Coupon.code comment), and while the storefront also
    // uppercases on input, direct api callers (curl, third-party clients)
    // don't — and lowercase silently 404s without this. Defense-in-depth.
    const normalisedCode = code.trim().toUpperCase();
    if (normalisedCode.length === 0) {
      return { status: COUPON_STATUS.INVALID, message: 'Enter a coupon code.', promotionRule: null };
    }
    const coupon = await prisma.coupon.findUnique({
      where: { code: normalisedCode },
      include: { promotion: true },
    });
    if (!coupon) {
      return { status: COUPON_STATUS.INVALID, message: 'No matching offer for this code.', promotionRule: null };
    }
    if (!coupon.isActive) {
      return { status: COUPON_STATUS.EXPIRED, message: 'This code is no longer active.', promotionRule: null };
    }
    if (!coupon.promotion.isActive) {
      return {
        status: COUPON_STATUS.INACTIVE_PROMOTION,
        message: 'This offer is no longer active.',
        promotionRule: null,
      };
    }
    const now = new Date();
    if (coupon.promotion.validFrom && coupon.promotion.validFrom > now) {
      return { status: COUPON_STATUS.EXPIRED, message: 'This code is not yet active.', promotionRule: null };
    }
    if (coupon.promotion.validTo && coupon.promotion.validTo < now) {
      return { status: COUPON_STATUS.EXPIRED, message: 'This code has expired.', promotionRule: null };
    }
    if (coupon.usageLimitTotal > 0 && coupon.usageCount >= coupon.usageLimitTotal) {
      return { status: COUPON_STATUS.LIMIT_REACHED, message: 'This code has reached its usage limit.', promotionRule: null };
    }
    // Per-customer cap: match the OR-style identity check that commitForOrder
    // uses (customerId OR phone). Without this, cart-evaluate could greenlight
    // a coupon that order-placement then rejects because the customerId match
    // adds another usage row the phone-only count didn't see.
    if (coupon.usageLimitPerCustomer > 0 && (ctx.phone || ctx.customerId)) {
      const identityClauses: Array<{ customerId?: string; phone?: string }> = [];
      if (ctx.customerId) identityClauses.push({ customerId: ctx.customerId });
      if (ctx.phone) identityClauses.push({ phone: ctx.phone });
      const used = await prisma.couponUsage.count({
        where: { couponId: coupon.id, OR: identityClauses },
      });
      if (used >= coupon.usageLimitPerCustomer) {
        return {
          status: COUPON_STATUS.LIMIT_REACHED,
          message: 'You have already used this code.',
          promotionRule: null,
        };
      }
    }
    return {
      status: COUPON_STATUS.APPLIED,
      message: null,
      promotionRule: parsePromotionRule(coupon.promotion, normalisedCode),
    };
  }

  private async findActiveAutomaticPromotions(): Promise<PromotionRule[]> {
    const now = new Date();
    const rows = await prisma.promotion.findMany({
      where: {
        isAutomatic: true,
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      orderBy: { stackPriority: 'asc' },
    });
    return rows.map((p) => parsePromotionRule(p, null));
  }
}

// =====================================================
// Helpers — kept module-scoped so the service stays slim
// =====================================================

type PromotionRow = Prisma.PromotionGetPayload<Record<string, never>>;
type CouponRow = Prisma.CouponGetPayload<Record<string, never>>;
type PromotionRowWithCoupons = Prisma.PromotionGetPayload<{
  include: { coupons: true; _count: { select: { coupons: true } } };
}>;

function shapePromotionSummary(p: PromotionRow, couponCount: number): PromotionSummary {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    isAutomatic: p.isAutomatic,
    isActive: p.isActive,
    stackable: p.stackable,
    stackPriority: p.stackPriority,
    validFrom: p.validFrom?.toISOString() ?? null,
    validTo: p.validTo?.toISOString() ?? null,
    usageCount: p.usageCount,
    couponCount,
    createdAt: p.createdAt.toISOString(),
  };
}

function shapePromotionDetail(p: PromotionRowWithCoupons): PromotionDetail {
  const conditions = z.array(promotionConditionSchema).parse((p.conditions as unknown) ?? []);
  const actions = z.array(promotionActionSchema).parse((p.actions as unknown) ?? []);
  return {
    ...shapePromotionSummary(p, p._count.coupons),
    conditions,
    actions,
    coupons: p.coupons.map(shapeCoupon),
  };
}

function shapeCoupon(c: CouponRow): CouponSummary {
  return {
    id: c.id,
    code: c.code,
    isActive: c.isActive,
    usageCount: c.usageCount,
    usageLimitTotal: c.usageLimitTotal,
    usageLimitPerCustomer: c.usageLimitPerCustomer,
    batchLabel: c.batchLabel,
    createdAt: c.createdAt.toISOString(),
  };
}

function parsePromotionRule(p: PromotionRow, redeemedCouponCode: string | null): PromotionRule {
  const conditions = z.array(promotionConditionSchema).parse((p.conditions as unknown) ?? []) as PromotionCondition[];
  const actions = z.array(promotionActionSchema).parse((p.actions as unknown) ?? []) as PromotionAction[];
  return {
    id: p.id,
    name: p.name,
    isAutomatic: p.isAutomatic,
    stackable: p.stackable,
    stackPriority: p.stackPriority,
    conditions,
    actions,
    redeemedCouponCode,
  };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
function generateCode(prefix: string | undefined, length: number): string {
  const head = (prefix ?? '').toUpperCase();
  const need = Math.max(2, length - head.length);
  let body = '';
  for (let i = 0; i < need; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${head}${body}`;
}
