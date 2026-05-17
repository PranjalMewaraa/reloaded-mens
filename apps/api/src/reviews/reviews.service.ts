import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  AUDIT_EVENT_TYPE,
  ORDER_STATE,
  REVIEW_STATUS,
  type AdminReviewListQuery,
  type AdminReviewListResponse,
  type AdminReviewSummary,
  type ProductReviewsQuery,
  type ProductReviewsResponse,
  type ReviewSubmissionPrompt,
  type SubmitReviewRequest,
} from '@repo/types';
import { AuditService } from '../audit/audit.service.js';
import { ReviewTokenService } from './review-token.service.js';

interface ActorCtx {
  adminUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// In-memory per-product aggregate cache so the PDP isn't hammered. 30s TTL is
// plenty — reviews change after admin moderation, not minute-to-minute.
const aggregateCache = new Map<string, { value: AggregateResult; expiresAt: number }>();
const AGG_TTL_MS = 30_000;

interface AggregateResult {
  averageRating: number | null;
  totalCount: number;
  histogram: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly audit: AuditService,
    private readonly tokens: ReviewTokenService,
  ) {}

  // =====================================================
  // Public — PDP listing + aggregate
  // =====================================================

  async getProductReviews(slug: string, query: ProductReviewsQuery): Promise<ProductReviewsResponse> {
    const product = await prisma.product.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!product) throw new NotFoundException(`Product ${slug} not found`);

    const orderBy: Prisma.ReviewOrderByWithRelationInput =
      query.sort === 'highest'
        ? { rating: 'desc' }
        : query.sort === 'lowest'
          ? { rating: 'asc' }
          : { createdAt: 'desc' };

    const [items, agg] = await Promise.all([
      prisma.review.findMany({
        where: { productId: product.id, status: REVIEW_STATUS.APPROVED },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.getAggregate(product.id),
    ]);

    return {
      productId: product.id,
      averageRating: agg.averageRating,
      totalCount: agg.totalCount,
      histogram: agg.histogram,
      items: items.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
    };
  }

  async getAggregate(productId: string): Promise<AggregateResult> {
    const cached = aggregateCache.get(productId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const rows = await prisma.review.groupBy({
      by: ['rating'],
      where: { productId, status: REVIEW_STATUS.APPROVED },
      _count: { _all: true },
    });

    const histogram = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    let sum = 0;
    for (const row of rows) {
      const star = row.rating as 1 | 2 | 3 | 4 | 5;
      if (star >= 1 && star <= 5) {
        histogram[star] = row._count._all;
        total += row._count._all;
        sum += star * row._count._all;
      }
    }
    const result: AggregateResult = {
      averageRating: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
      totalCount: total,
      histogram,
    };
    aggregateCache.set(productId, { value: result, expiresAt: Date.now() + AGG_TTL_MS });
    return result;
  }

  invalidateAggregate(productId: string) {
    aggregateCache.delete(productId);
  }

  async getAggregatesByProductIds(productIds: string[]): Promise<Map<string, AggregateResult>> {
    const result = new Map<string, AggregateResult>();
    // Fast path: try cache for all, fall back to DB groupBy for misses.
    const misses: string[] = [];
    for (const id of productIds) {
      const cached = aggregateCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        result.set(id, cached.value);
      } else {
        misses.push(id);
      }
    }
    if (misses.length > 0) {
      const rows = await prisma.review.groupBy({
        by: ['productId', 'rating'],
        where: { productId: { in: misses }, status: REVIEW_STATUS.APPROVED },
        _count: { _all: true },
      });
      const byProduct = new Map<string, AggregateResult>();
      for (const id of misses) {
        byProduct.set(id, { averageRating: null, totalCount: 0, histogram: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
      }
      for (const row of rows) {
        const agg = byProduct.get(row.productId)!;
        const star = row.rating as 1 | 2 | 3 | 4 | 5;
        if (star >= 1 && star <= 5) {
          agg.histogram[star] = row._count._all;
        }
      }
      const now = Date.now();
      for (const [id, agg] of byProduct) {
        let total = 0;
        let sum = 0;
        for (const s of [1, 2, 3, 4, 5] as const) {
          total += agg.histogram[s];
          sum += s * agg.histogram[s];
        }
        agg.totalCount = total;
        agg.averageRating = total > 0 ? Math.round((sum / total) * 10) / 10 : null;
        aggregateCache.set(id, { value: agg, expiresAt: now + AGG_TTL_MS });
        result.set(id, agg);
      }
    }
    return result;
  }

  // =====================================================
  // Public — submission (token-gated)
  // =====================================================

  async getSubmissionPrompt(orderItemId: string, token: string): Promise<ReviewSubmissionPrompt> {
    const item = await this.loadOrderItemForToken(orderItemId, token);
    const existing = await prisma.review.findUnique({ where: { orderItemId } });
    return {
      orderItemId,
      productSlug: item.variant.product.slug,
      productName: item.productName,
      variantLabel: item.variantLabel,
      customerName: item.order.customer?.name ?? '',
      alreadySubmitted: !!existing,
      alreadyApproved: existing?.status === REVIEW_STATUS.APPROVED,
      submittedRating: existing?.rating ?? null,
    };
  }

  async submitReview(
    orderItemId: string,
    token: string,
    body: SubmitReviewRequest,
    ctx: ActorCtx,
  ): Promise<ReviewSubmissionPrompt> {
    const item = await this.loadOrderItemForToken(orderItemId, token);

    // Idempotent — re-posts return the existing record so the form gracefully
    // renders the "thanks" card on a refresh.
    const existing = await prisma.review.findUnique({ where: { orderItemId } });
    if (existing) {
      return {
        orderItemId,
        productSlug: item.variant.product.slug,
        productName: item.productName,
        variantLabel: item.variantLabel,
        customerName: existing.authorName,
        alreadySubmitted: true,
        alreadyApproved: existing.status === REVIEW_STATUS.APPROVED,
        submittedRating: existing.rating,
      };
    }

    const productId = item.variant.product.id;
    await prisma.review.create({
      data: {
        productId,
        orderItemId,
        customerId: item.order.customer?.id ?? null,
        authorName: item.order.customer?.name ?? 'Customer',
        rating: body.rating,
        title: body.title,
        body: body.body,
        status: REVIEW_STATUS.PENDING,
      },
    });

    this.invalidateAggregate(productId);

    await this.audit.write(AUDIT_EVENT_TYPE.REVIEW_SUBMITTED, {
      ...ctx,
      resource: `review:orderItem=${orderItemId}`,
      payload: { rating: body.rating, productId },
    });

    return {
      orderItemId,
      productSlug: item.variant.product.slug,
      productName: item.productName,
      variantLabel: item.variantLabel,
      customerName: item.order.customer?.name ?? '',
      alreadySubmitted: true,
      alreadyApproved: false,
      submittedRating: body.rating,
    };
  }

  // =====================================================
  // Admin — moderation
  // =====================================================

  async listAdmin(query: AdminReviewListQuery): Promise<AdminReviewListResponse> {
    const where: Prisma.ReviewWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;
    const [total, rows] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          product: { select: { name: true, slug: true } },
          orderItem: { include: { order: { select: { orderNumber: true } } } },
        },
      }),
    ]);
    return {
      items: rows.map(shapeAdmin),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async approve(id: string, ctx: ActorCtx): Promise<AdminReviewSummary> {
    const review = await prisma.review.findUnique({ where: { id }, select: { productId: true, status: true } });
    if (!review) throw new NotFoundException(`Review ${id} not found`);
    if (review.status === REVIEW_STATUS.APPROVED) {
      // No-op — return the fresh shape so the UI updates without a refresh.
    }
    const updated = await prisma.review.update({
      where: { id },
      data: {
        status: REVIEW_STATUS.APPROVED,
        approvedAt: new Date(),
        rejectedAt: null,
        rejectedReason: null,
      },
      include: {
        product: { select: { name: true, slug: true } },
        orderItem: { include: { order: { select: { orderNumber: true } } } },
      },
    });
    this.invalidateAggregate(review.productId);
    await this.audit.write(AUDIT_EVENT_TYPE.REVIEW_APPROVED, {
      ...ctx,
      resource: `review:${id}`,
    });
    return shapeAdmin(updated);
  }

  async reject(id: string, reason: string, ctx: ActorCtx): Promise<AdminReviewSummary> {
    const review = await prisma.review.findUnique({ where: { id }, select: { productId: true, status: true } });
    if (!review) throw new NotFoundException(`Review ${id} not found`);
    const updated = await prisma.review.update({
      where: { id },
      data: {
        status: REVIEW_STATUS.REJECTED,
        rejectedAt: new Date(),
        approvedAt: null,
        rejectedReason: reason,
      },
      include: {
        product: { select: { name: true, slug: true } },
        orderItem: { include: { order: { select: { orderNumber: true } } } },
      },
    });
    this.invalidateAggregate(review.productId);
    await this.audit.write(AUDIT_EVENT_TYPE.REVIEW_REJECTED, {
      ...ctx,
      resource: `review:${id}`,
      payload: { reason },
    });
    return shapeAdmin(updated);
  }

  // =====================================================
  // Review invite emails — build per-orderItem tokens for an order
  // =====================================================

  buildReviewLinksForOrder(args: {
    storefrontUrl: string;
    orderId: string;
    customerId: string | null;
    items: { id: string }[];
  }): Array<{ orderItemId: string; reviewUrl: string }> {
    const keyPart = args.customerId ?? args.orderId;
    return args.items.map((item) => ({
      orderItemId: item.id,
      reviewUrl: `${args.storefrontUrl.replace(/\/$/, '')}/review/${item.id}?t=${this.tokens.sign(item.id, keyPart)}`,
    }));
  }

  // =====================================================
  // Internal — token-gated order item loader
  // =====================================================

  private async loadOrderItemForToken(orderItemId: string, token: string) {
    if (!token) throw new UnauthorizedException('Missing review token');
    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true } },
          },
        },
        variant: { include: { product: { select: { id: true, slug: true } } } },
      },
    });
    if (!item) throw new NotFoundException(`Order item ${orderItemId} not found`);
    // Reviews are only valid for delivered orders. Sprint 12 may relax this
    // for in-store-pickup once that flow exists.
    if (item.order.state !== ORDER_STATE.DELIVERED) {
      throw new BadRequestException({ reason: 'order_not_delivered', message: 'Reviews open once the order is delivered' });
    }
    const keyPart = item.order.customer?.id ?? item.order.id;
    const expected = this.tokens.sign(orderItemId, keyPart);
    if (!this.tokens.verify(expected, token)) {
      throw new UnauthorizedException({ reason: 'invalid_token', message: 'Invalid review token' });
    }
    return item;
  }
}

// =====================================================
// Helpers
// =====================================================

type AdminReviewRow = Prisma.ReviewGetPayload<{
  include: {
    product: { select: { name: true; slug: true } };
    orderItem: { include: { order: { select: { orderNumber: true } } } };
  };
}>;

function shapeAdmin(row: AdminReviewRow): AdminReviewSummary {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    orderItemId: row.orderItemId,
    orderNumber: row.orderItem.order.orderNumber,
    authorName: row.authorName,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    rejectedReason: row.rejectedReason,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Re-export for callers that want the enum constant.
export { REVIEW_STATUS };
