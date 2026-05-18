import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import { ACTOR, type Actor } from '@repo/types';
import type {
  CreateVariantInput,
  InventoryListQuery,
  MatrixCreateInput,
  StockAdjustInput,
  UpdateVariantInput,
} from '@repo/types';

@Injectable()
export class VariantsService {
  async listForProduct(productId: string) {
    await this.ensureProductExists(productId);
    return prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(productId: string, input: CreateVariantInput) {
    await this.ensureProductExists(productId);
    const clash = await prisma.productVariant.findUnique({ where: { sku: input.sku } });
    if (clash) throw new ConflictException(`SKU "${input.sku}" already exists`);
    return prisma.productVariant.create({
      data: {
        productId,
        sku: input.sku,
        size: input.size ?? null,
        color: input.color ?? null,
        priceOverridePaisa: input.priceOverridePaisa ?? null,
        stockCount: input.stockCount,
        lowStockThreshold: input.lowStockThreshold,
        barcode: input.barcode ?? null,
        isActive: input.isActive,
      },
    });
  }

  // Matrix generator: produce the cartesian product of axes and create only the rows that
  // don't already exist for this product. Idempotent — call twice with same axes, get the
  // same set without errors. Throws if a generated SKU collides with an existing variant
  // on a *different* product (SKU is globally unique).
  async createMatrix(productId: string, input: MatrixCreateInput) {
    await this.ensureProductExists(productId);

    const sizes = input.axes.size && input.axes.size.length > 0 ? input.axes.size : [null];
    const colors = input.axes.color && input.axes.color.length > 0 ? input.axes.color : [null];

    const existing = await prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      select: { size: true, color: true, sku: true },
    });
    const existingPairs = new Set(
      existing.map((v) => `${v.size ?? ''}::${v.color ?? ''}`),
    );

    type ToCreate = {
      productId: string;
      sku: string;
      size: string | null;
      color: string | null;
      priceOverridePaisa: number | null;
      stockCount: number;
      lowStockThreshold: number;
      isActive: boolean;
    };
    const toCreate: ToCreate[] = [];
    const seenSku = new Set<string>();
    for (const size of sizes) {
      for (const color of colors) {
        const key = `${size ?? ''}::${color ?? ''}`;
        if (existingPairs.has(key)) continue;
        const sku = composeSku(input.skuPrefix, size, color);
        if (seenSku.has(sku)) {
          throw new BadRequestException(
            `Matrix generated duplicate SKU "${sku}". Check axes for repeats.`,
          );
        }
        seenSku.add(sku);
        toCreate.push({
          productId,
          sku,
          size,
          color,
          priceOverridePaisa: input.defaults.priceOverridePaisa ?? null,
          stockCount: input.defaults.stockCount,
          lowStockThreshold: input.defaults.lowStockThreshold,
          isActive: true,
        });
      }
    }

    if (toCreate.length === 0) {
      return this.listForProduct(productId);
    }

    // Check for cross-product SKU conflicts before the bulk create.
    const skuClashes = await prisma.productVariant.findMany({
      where: { sku: { in: toCreate.map((c) => c.sku) } },
      select: { sku: true },
    });
    if (skuClashes.length > 0) {
      throw new ConflictException(
        `SKUs already in use on other products: ${skuClashes.map((c) => c.sku).join(', ')}`,
      );
    }

    await prisma.$transaction([
      prisma.productVariant.createMany({ data: toCreate }),
    ]);

    return this.listForProduct(productId);
  }

  async update(id: string, input: UpdateVariantInput) {
    const existing = await this.ensureVariantExists(id);
    if (input.sku && input.sku !== existing.sku) {
      const clash = await prisma.productVariant.findFirst({
        where: { sku: input.sku, NOT: { id } },
      });
      if (clash) throw new ConflictException(`SKU "${input.sku}" already exists`);
    }
    const data: Prisma.ProductVariantUpdateInput = {};
    if (input.sku !== undefined) data.sku = input.sku;
    if (input.size !== undefined) data.size = input.size ?? null;
    if (input.color !== undefined) data.color = input.color ?? null;
    if (input.priceOverridePaisa !== undefined)
      data.priceOverridePaisa = input.priceOverridePaisa ?? null;
    if (input.lowStockThreshold !== undefined) data.lowStockThreshold = input.lowStockThreshold;
    if (input.barcode !== undefined) data.barcode = input.barcode ?? null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return prisma.productVariant.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureVariantExists(id);
    await prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // The acceptance gate. Single tx so the InventoryEvent row and the new stockCount can
  // never diverge. Refuses negative final stock — corrections must explicitly land at >= 0.
  async adjustStock(
    variantId: string,
    input: StockAdjustInput,
    actor: { actor: Actor; actorId: string | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, deletedAt: null },
      });
      if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

      const stockBefore = variant.stockCount;
      const stockAfter = stockBefore + input.delta;
      if (stockAfter < 0) {
        throw new BadRequestException(
          `Adjustment would set stock to ${stockAfter}. Stock must be >= 0.`,
        );
      }

      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { stockCount: stockAfter },
      });

      const event = await tx.inventoryEvent.create({
        data: {
          variantId,
          changeType: input.changeType,
          delta: input.delta,
          stockBefore,
          stockAfter,
          actor: actor.actor,
          actorId: actor.actorId,
          note: input.note ?? null,
        },
      });

      return { variant: updated, event };
    });
  }

  async getEvents(variantId: string, limit = 50) {
    await this.ensureVariantExists(variantId);
    return prisma.inventoryEvent.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  // For the /inventory page — variants with a small product hop and last-event timestamp.
  // Sprint 9 Phase 3b — returns stock-state aggregates alongside the list so the
  // page can render the top stat row without a second round-trip. Supports the
  // chip-filter (`all` / `in_stock` / `low` / `out`) and a small sort vocab.
  async listInventory(query: InventoryListQuery) {
    const baseWhere: Prisma.ProductVariantWhereInput = { deletedAt: null };
    if (query.q) {
      baseWhere.OR = [
        { sku: { contains: query.q, mode: 'insensitive' } },
        { product: { name: { contains: query.q, mode: 'insensitive' } } },
      ];
    }

    // stockFilter wins over the legacy lowStockOnly flag when both are present.
    const stockFilter: 'all' | 'in_stock' | 'low' | 'out' =
      query.stockFilter ?? (query.lowStockOnly ? 'low' : 'all');

    // 'out' is a single-column comparison so Prisma can do it natively. 'low'
    // and 'in_stock' need stockCount vs lowStockThreshold which Prisma can't
    // express in WHERE — those branches post-filter in memory below.
    const where: Prisma.ProductVariantWhereInput = { ...baseWhere };
    if (stockFilter === 'out') {
      where.stockCount = { lte: 0 };
    }

    const orderBy: Prisma.ProductVariantOrderByWithRelationInput[] =
      query.sort === 'lowest_stock'
        ? [{ stockCount: 'asc' }, { updatedAt: 'desc' }]
        : query.sort === 'name_asc'
          ? [{ product: { name: 'asc' } }, { sku: 'asc' }]
          : query.sort === 'sku_asc'
            ? [{ sku: 'asc' }]
            : [{ updatedAt: 'desc' }];

    // Aggregates — describe the catalog scoped to the active search (if any)
    // so the stat row reflects what the operator is looking at, regardless of
    // which stock chip they've clicked.
    const [aggTotal, aggOut, aggCandidates] = await Promise.all([
      prisma.productVariant.count({ where: baseWhere }),
      prisma.productVariant.count({ where: { ...baseWhere, stockCount: { lte: 0 } } }),
      prisma.productVariant.findMany({
        where: { ...baseWhere, stockCount: { gt: 0 } },
        select: { stockCount: true, lowStockThreshold: true },
      }),
    ]);
    const aggLow = aggCandidates.filter((r) => r.stockCount <= r.lowStockThreshold).length;
    const aggInStock = aggCandidates.length - aggLow;
    const aggregates = {
      total: aggTotal,
      inStock: aggInStock,
      low: aggLow,
      out: aggOut,
    };

    // Main fetch. When stockFilter requires post-filter we fetch the full set
    // and slice in memory — catalogues are small enough (<5k variants) that
    // this is fine. Revisit with raw SQL if it ever matters.
    const needsPostFilter = stockFilter === 'low' || stockFilter === 'in_stock';
    const include = {
      product: { select: { id: true, name: true, slug: true } },
      inventoryEvents: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { createdAt: true, changeType: true, delta: true },
      },
    } satisfies Prisma.ProductVariantInclude;

    const [rawTotal, rows] = await Promise.all([
      prisma.productVariant.count({ where }),
      needsPostFilter
        ? prisma.productVariant.findMany({ where, orderBy, include })
        : prisma.productVariant.findMany({
            where,
            orderBy,
            include,
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
    ]);

    const filteredRows = needsPostFilter
      ? rows.filter((r) =>
          stockFilter === 'low'
            ? r.stockCount > 0 && r.stockCount <= r.lowStockThreshold
            : r.stockCount > r.lowStockThreshold,
        )
      : rows;

    const total = needsPostFilter ? filteredRows.length : rawTotal;
    const pageRows = needsPostFilter
      ? filteredRows.slice((query.page - 1) * query.limit, query.page * query.limit)
      : filteredRows;

    const items = pageRows.map((r) => ({
      id: r.id,
      sku: r.sku,
      size: r.size,
      color: r.color,
      stockCount: r.stockCount,
      lowStockThreshold: r.lowStockThreshold,
      isActive: r.isActive,
      product: r.product,
      lastEvent: r.inventoryEvents[0] ?? null,
      updatedAt: r.updatedAt,
    }));

    return { items, page: query.page, limit: query.limit, total, aggregates };
  }

  private async ensureProductExists(productId: string): Promise<void> {
    const exists = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Product ${productId} not found`);
  }

  private async ensureVariantExists(id: string) {
    const existing = await prisma.productVariant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Variant ${id} not found`);
    return existing;
  }
}

// Compose SKU: '<PREFIX>-<SIZE>-<COLOR>' (parts omitted if axis is null). Sanitises to
// uppercase letters/digits/hyphens to match skuSchema in @repo/types.
function composeSku(prefix: string, size: string | null, color: string | null): string {
  const parts = [prefix];
  if (size) parts.push(sanitizeSkuPart(size));
  if (color) parts.push(sanitizeSkuPart(color));
  return parts.filter(Boolean).join('-');
}

function sanitizeSkuPart(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// Unused export — exposed for testability of the SKU composer.
export const __test = { composeSku, sanitizeSkuPart };

// Re-export ACTOR for convenience to controllers in this module.
export { ACTOR };
