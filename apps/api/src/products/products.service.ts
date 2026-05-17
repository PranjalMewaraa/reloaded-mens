import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import {
  productImageSchema,
  type CreateProductInput,
  type ProductListQuery,
  type SetProductCategoriesInput,
  type UpdateProductInput,
} from '@repo/types';
import { z } from 'zod';

const imagesArraySchema = z.array(productImageSchema);

@Injectable()
export class ProductsService {
  async list(query: ProductListQuery) {
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.availabilityFlag) where.availabilityFlag = query.availabilityFlag;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) {
      where.productCategories = { some: { categoryId: query.categoryId } };
    }

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          slug: true,
          name: true,
          basePricePaisa: true,
          compareAtPricePaisa: true,
          availabilityFlag: true,
          isActive: true,
          images: true,
          updatedAt: true,
          _count: { select: { variants: { where: { deletedAt: null } } } },
          productCategories: { select: { categoryId: true } },
        },
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        basePricePaisa: r.basePricePaisa,
        compareAtPricePaisa: r.compareAtPricePaisa,
        availabilityFlag: r.availabilityFlag,
        isActive: r.isActive,
        primaryImageUrl: extractPrimaryImageUrl(r.images),
        variantCount: r._count.variants,
        categoryIds: r.productCategories.map((pc) => pc.categoryId),
        updatedAt: r.updatedAt,
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async getOne(id: string) {
    const row = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        productCategories: { select: { categoryId: true } },
      },
    });
    if (!row) throw new NotFoundException(`Product ${id} not found`);
    return {
      ...row,
      categoryIds: row.productCategories.map((pc) => pc.categoryId),
      // Mirror Prisma's Json type to the schema's typed shape for the response.
      images: imagesArraySchema.safeParse(row.images).data ?? [],
    };
  }

  async create(input: CreateProductInput) {
    const clash = await prisma.product.findUnique({ where: { slug: input.slug } });
    if (clash) throw new ConflictException(`Slug "${input.slug}" already exists`);
    return prisma.product.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        hsnCode: input.hsnCode ?? null,
        gstRatePercent: input.gstRatePercent ?? null,
        availabilityFlag: input.availabilityFlag,
        basePricePaisa: input.basePricePaisa,
        compareAtPricePaisa: input.compareAtPricePaisa ?? null,
        costPricePaisa: input.costPricePaisa ?? null,
        isActive: input.isActive,
        isReturnable: input.isReturnable,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        ogImageUrl: input.ogImageUrl ?? null,
      },
    });
  }

  async update(id: string, input: UpdateProductInput) {
    await this.ensureExists(id);
    if (input.slug) {
      const clash = await prisma.product.findFirst({
        where: { slug: input.slug, NOT: { id } },
      });
      if (clash) throw new ConflictException(`Slug "${input.slug}" already exists`);
    }
    const data: Prisma.ProductUpdateInput = {};
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.hsnCode !== undefined) data.hsnCode = input.hsnCode ?? null;
    if (input.gstRatePercent !== undefined) data.gstRatePercent = input.gstRatePercent ?? null;
    if (input.availabilityFlag !== undefined) data.availabilityFlag = input.availabilityFlag;
    if (input.basePricePaisa !== undefined) data.basePricePaisa = input.basePricePaisa;
    if (input.compareAtPricePaisa !== undefined)
      data.compareAtPricePaisa = input.compareAtPricePaisa ?? null;
    if (input.costPricePaisa !== undefined) data.costPricePaisa = input.costPricePaisa ?? null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isReturnable !== undefined) data.isReturnable = input.isReturnable;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle ?? null;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription ?? null;
    if (input.ogImageUrl !== undefined) data.ogImageUrl = input.ogImageUrl ?? null;
    if (input.images !== undefined) {
      // Re-validate to keep DB consistent even if a controller forgets the pipe.
      data.images = imagesArraySchema.parse(input.images);
    }
    return prisma.product.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    const now = new Date();
    await prisma.$transaction([
      prisma.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.product.update({ where: { id }, data: { deletedAt: now } }),
    ]);
  }

  async setCategories(id: string, input: SetProductCategoriesInput) {
    await this.ensureExists(id);
    // Deduplicate while preserving order.
    const ids = Array.from(new Set(input.categoryIds));
    await prisma.$transaction(async (tx) => {
      await tx.productCategory.deleteMany({ where: { productId: id } });
      if (ids.length > 0) {
        // Verify all category ids exist (and aren't deleted) to fail loudly on bad input.
        const found = await tx.category.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: { id: true },
        });
        if (found.length !== ids.length) {
          throw new NotFoundException('One or more categoryIds not found');
        }
        await tx.productCategory.createMany({
          data: ids.map((categoryId, sortOrder) => ({
            productId: id,
            categoryId,
            sortOrder,
          })),
        });
      }
    });
    return { categoryIds: ids };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Product ${id} not found`);
  }
}

function extractPrimaryImageUrl(images: Prisma.JsonValue): string | null {
  const parsed = imagesArraySchema.safeParse(images);
  if (!parsed.success || parsed.data.length === 0) return null;
  // The schema preserves sortOrder; primary is index 0 after the editor sorts.
  const sorted = [...parsed.data].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted[0].url;
}
