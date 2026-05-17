import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@repo/db';
import type {
  CreateCategoryInput,
  ReorderCategoriesInput,
  UpdateCategoryInput,
} from '@repo/types';

// Raw row shape pulled from Prisma; the tree adds `children` on top.
type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

export interface CategoryTreeNode extends CategoryRow {
  children: CategoryTreeNode[];
}

const ROW_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  parentId: true,
  imageUrl: true,
  sortOrder: true,
  isActive: true,
  seoTitle: true,
  seoDescription: true,
} satisfies Prisma.CategorySelect;

@Injectable()
export class CategoriesService {
  // Build the full tree in one query + an in-memory grouping pass. Cheap for the size we
  // care about (hundreds, not millions).
  async getTree(opts: { activeOnly?: boolean } = {}): Promise<CategoryTreeNode[]> {
    const where: Prisma.CategoryWhereInput = { deletedAt: null };
    if (opts.activeOnly) where.isActive = true;
    const rows = await prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: ROW_SELECT,
    });
    return buildTree(rows);
  }

  async getOne(id: string): Promise<CategoryRow> {
    const row = await prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: ROW_SELECT,
    });
    if (!row) throw new NotFoundException(`Category ${id} not found`);
    return row;
  }

  async create(input: CreateCategoryInput): Promise<CategoryRow> {
    const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException(`Slug "${input.slug}" already exists`);
    if (input.parentId) await this.ensureExists(input.parentId);
    return prisma.category.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
      },
      select: ROW_SELECT,
    });
  }

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryRow> {
    await this.ensureExists(id);
    if (input.slug) {
      const clash = await prisma.category.findFirst({
        where: { slug: input.slug, NOT: { id } },
      });
      if (clash) throw new ConflictException(`Slug "${input.slug}" already exists`);
    }
    if (input.parentId) {
      if (input.parentId === id) throw new ConflictException('Cannot parent a category to itself');
      await this.ensureExists(input.parentId);
    }
    // Strip undefineds so Prisma doesn't try to set columns to undefined.
    const data: Prisma.CategoryUpdateInput = {};
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.parentId !== undefined) {
      data.parent = input.parentId
        ? { connect: { id: input.parentId } }
        : { disconnect: true };
    }
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle ?? null;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription ?? null;

    return prisma.category.update({ where: { id }, data, select: ROW_SELECT });
  }

  // Soft delete. Refuses if any non-deleted children still point here — admin must
  // reparent or delete them first to keep the tree consistent.
  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    const childCount = await prisma.category.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException({
        statusCode: 409,
        reason: 'has_children',
        message: `Category has ${childCount} child categories. Reparent or delete them first.`,
      });
    }
    await prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Apply bulk reorder/reparent in one tx. The admin app sends one update per moved node.
  async reorder(input: ReorderCategoriesInput): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const u of input.updates) {
        if (u.parentId === u.id) {
          throw new ConflictException(`Category ${u.id} cannot be its own parent`);
        }
        await tx.category.update({
          where: { id: u.id },
          data: { parentId: u.parentId, sortOrder: u.sortOrder },
        });
      }
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Category ${id} not found`);
  }
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
