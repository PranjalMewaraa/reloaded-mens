import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  productImageSchema,
  serviceablePincodesSettingSchema,
  type PublicProductListQuery,
  type ServiceabilityResponse,
} from '@repo/types';
import { z } from 'zod';
import { ReviewsService } from '../reviews/reviews.service.js';

// Public-facing service. Always filters to `isActive: true` and `deletedAt: null` — the
// admin's catalog endpoints intentionally show inactive rows; this one never does.

const imagesSchema = z.array(productImageSchema);

const ROW_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  basePricePaisa: true,
  compareAtPricePaisa: true,
  availabilityFlag: true,
  images: true,
  isReturnable: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class PublicCatalogService {
  constructor(private readonly reviews: ReviewsService) {}

  // -------- products --------

  async listProducts(query: PublicProductListQuery) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
    };

    if (!query.includeInStore) {
      where.availabilityFlag = { in: ['online_shippable', 'both'] };
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.category) {
      where.productCategories = {
        some: {
          category: { slug: query.category, deletedAt: null, isActive: true },
        },
      };
    }
    if (query.size || query.color) {
      where.variants = {
        some: {
          deletedAt: null,
          isActive: true,
          ...(query.size ? { size: { equals: query.size, mode: 'insensitive' } } : {}),
          ...(query.color ? { color: { equals: query.color, mode: 'insensitive' } } : {}),
        },
      };
    }
    if (query.minPricePaisa !== undefined || query.maxPricePaisa !== undefined) {
      where.basePricePaisa = {
        ...(query.minPricePaisa !== undefined ? { gte: query.minPricePaisa } : {}),
        ...(query.maxPricePaisa !== undefined ? { lte: query.maxPricePaisa } : {}),
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'new'
        ? [{ createdAt: 'desc' }]
        : query.sort === 'price-asc'
          ? [{ basePricePaisa: 'asc' }]
          : query.sort === 'price-desc'
            ? [{ basePricePaisa: 'desc' }]
            : // featured = admin's editorial order; use updatedAt as a stable proxy until
              // we add explicit feature flags in a later sprint.
              [{ updatedAt: 'desc' }];

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          ...ROW_SELECT,
          variants: {
            where: { deletedAt: null, isActive: true },
            select: { id: true, size: true, color: true, stockCount: true },
          },
        },
      }),
    ]);

    const aggregates = await this.reviews.getAggregatesByProductIds(rows.map((r) => r.id));
    return {
      items: rows.map((row) => withReviewSummary(toPublicCardShape(row), aggregates.get(row.id))),
      page: query.page,
      limit: query.limit,
      total,
      sort: query.sort,
    };
  }

  async getProductBySlug(slug: string) {
    const row = await prisma.product.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      select: {
        ...ROW_SELECT,
        hsnCode: true,
        gstRatePercent: true,
        seoTitle: true,
        seoDescription: true,
        ogImageUrl: true,
        variants: {
          where: { deletedAt: null, isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            stockCount: true,
            priceOverridePaisa: true,
          },
        },
        productCategories: {
          select: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException(`Product "${slug}" not found`);

    const aggregate = await this.reviews.getAggregate(row.id);

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      basePricePaisa: row.basePricePaisa,
      compareAtPricePaisa: row.compareAtPricePaisa,
      availabilityFlag: row.availabilityFlag,
      isReturnable: row.isReturnable,
      images: imagesSchema.safeParse(row.images).data ?? [],
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      ogImageUrl: row.ogImageUrl,
      categories: row.productCategories.map((pc) => pc.category),
      variants: row.variants,
      averageRating: aggregate.averageRating,
      reviewCount: aggregate.totalCount,
    };
  }

  // Related products — same category, different product, active+shippable. Falls back to
  // a "newest" list if the product has no categories.
  async getRelated(productId: string, limit = 8) {
    const categoryIds = await prisma.productCategory.findMany({
      where: { productId },
      select: { categoryId: true },
    });

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
      id: { not: productId },
      availabilityFlag: { in: ['online_shippable', 'both'] },
      ...(categoryIds.length > 0
        ? { productCategories: { some: { categoryId: { in: categoryIds.map((c) => c.categoryId) } } } }
        : {}),
    };

    const rows = await prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 24),
      select: {
        ...ROW_SELECT,
        variants: {
          where: { deletedAt: null, isActive: true },
          select: { id: true, size: true, color: true, stockCount: true },
        },
      },
    });

    const aggregates = await this.reviews.getAggregatesByProductIds(rows.map((r) => r.id));
    return rows.map((row) => withReviewSummary(toPublicCardShape(row), aggregates.get(row.id)));
  }

  // -------- categories --------

  async listCategoryTree() {
    const rows = await prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        parentId: true,
        imageUrl: true,
        sortOrder: true,
      },
    });
    return { items: buildTree(rows) };
  }

  async getCategoryBySlug(slug: string) {
    const row = await prisma.category.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        imageUrl: true,
        seoTitle: true,
        seoDescription: true,
      },
    });
    if (!row) throw new NotFoundException(`Category "${slug}" not found`);
    return row;
  }

  // -------- serviceability --------

  async checkServiceability(pincode: string): Promise<ServiceabilityResponse> {
    const setting = await prisma.setting.findUnique({
      where: { key: 'serviceable_pincodes' },
    });

    const parsed = setting
      ? serviceablePincodesSettingSchema.safeParse(setting.value)
      : null;
    const allowlist = parsed?.success ? parsed.data : { prefixes: [], exact: [] };

    const matchesExact = allowlist.exact.includes(pincode);
    const matchesPrefix = allowlist.prefixes.some((p) => pincode.startsWith(p));
    const serviceable = matchesExact || matchesPrefix;

    return {
      pincode,
      serviceable,
      etaDaysMin: serviceable ? 3 : null,
      etaDaysMax: serviceable ? 5 : null,
      cod: serviceable,
      freeShippingThresholdPaisa: 149900,
    };
  }
}

// =====================================================
// Helpers
// =====================================================

function toPublicCardShape<T extends {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  availabilityFlag: string;
  images: Prisma.JsonValue;
  variants: Array<{ id: string; size: string | null; color: string | null; stockCount: number }>;
  updatedAt: Date;
}>(row: T) {
  const images = imagesSchema.safeParse(row.images).data ?? [];
  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const primary = sortedImages[0] ?? null;
  const secondary = sortedImages[1] ?? null;

  const colors = Array.from(
    new Set(
      row.variants
        .map((v) => v.color)
        .filter((c): c is string => Boolean(c)),
    ),
  );
  const sizes = Array.from(
    new Set(
      row.variants
        .map((v) => v.size)
        .filter((s): s is string => Boolean(s)),
    ),
  );
  const totalStock = row.variants.reduce((sum, v) => sum + v.stockCount, 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    basePricePaisa: row.basePricePaisa,
    compareAtPricePaisa: row.compareAtPricePaisa,
    availabilityFlag: row.availabilityFlag,
    primaryImageUrl: primary?.url ?? null,
    secondaryImageUrl: secondary?.url ?? null,
    primaryImageAlt: primary?.alt ?? row.name,
    colors,
    sizes,
    totalStock,
    isLowStock: totalStock > 0 && totalStock <= 5,
    isOutOfStock: totalStock <= 0,
  };
}

interface ReviewAggregateLite {
  averageRating: number | null;
  totalCount: number;
}

function withReviewSummary<T>(card: T, aggregate: ReviewAggregateLite | undefined) {
  return {
    ...card,
    averageRating: aggregate?.averageRating ?? null,
    reviewCount: aggregate?.totalCount ?? 0,
  };
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

interface CategoryTreeNode extends CategoryRow {
  children: CategoryTreeNode[];
}

function buildTree(rows: CategoryRow[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });
  const roots: CategoryTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
