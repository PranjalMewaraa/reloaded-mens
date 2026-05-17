// Catalogue + inventory DTOs — Sprint 2.
// Shared between the NestJS API (used in ZodValidationPipe) and the Next.js admin
// (used in server actions). Prisma models live in packages/db/prisma/schema.prisma.

import { z } from 'zod';
import { AVAILABILITY, INVENTORY_CHANGE_TYPE } from './enums.js';
import { paisaSchema, pincodeSchema, slugSchema } from './schemas.js';

// =====================================================
// Categories
// =====================================================

// Recursive node shape — explicit interface so the lazy() reference type-checks.
export interface CategoryNode {
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
  children: CategoryNode[];
}

export const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    parentId: z.string().nullable(),
    imageUrl: z.string().nullable(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    children: z.array(categoryNodeSchema),
  }),
);

export const createCategorySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  parentId: z.string().nullish(),
  imageUrl: z.string().url().nullish(),
  sortOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(120).nullish(),
  seoDescription: z.string().max(320).nullish(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const reorderCategoriesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string(),
        parentId: z.string().nullable(),
        sortOrder: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

// =====================================================
// Products
// =====================================================

export const productImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(160).default(''),
  sortOrder: z.number().int().nonnegative(),
});
export type ProductImage = z.infer<typeof productImageSchema>;

export const availabilityFlagSchema = z.enum([
  AVAILABILITY.ONLINE_SHIPPABLE,
  AVAILABILITY.IN_STORE_ONLY,
  AVAILABILITY.BOTH,
]);

// GST rate as whole percent. Schema is permissive (any int 0-28) but the admin UI
// constrains it to the canonical {0,5,12,18,28}.
const gstRateSchema = z.number().int().min(0).max(50);

export const createProductSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(8000).nullish(),
  hsnCode: z.string().max(20).nullish(),
  gstRatePercent: gstRateSchema.nullish(),
  availabilityFlag: availabilityFlagSchema.default(AVAILABILITY.ONLINE_SHIPPABLE),
  basePricePaisa: paisaSchema,
  compareAtPricePaisa: paisaSchema.nullish(),
  costPricePaisa: paisaSchema.nullish(),
  isActive: z.boolean().default(true),
  isReturnable: z.boolean().default(true),
  seoTitle: z.string().max(120).nullish(),
  seoDescription: z.string().max(320).nullish(),
  ogImageUrl: z.string().url().nullish(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  images: z.array(productImageSchema).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  availabilityFlag: availabilityFlagSchema.optional(),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const setProductCategoriesSchema = z.object({
  categoryIds: z.array(z.string()).max(50),
});
export type SetProductCategoriesInput = z.infer<typeof setProductCategoriesSchema>;

// =====================================================
// Variants
// =====================================================

// SKU: uppercase letters, digits, hyphens. Customer-facing on labels so keep it tidy.
export const skuSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'SKU must be uppercase letters/digits with hyphens');

export const createVariantSchema = z.object({
  sku: skuSchema,
  size: z.string().max(40).nullish(),
  color: z.string().max(40).nullish(),
  priceOverridePaisa: paisaSchema.nullish(),
  stockCount: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(3),
  barcode: z.string().max(64).nullish(),
  isActive: z.boolean().default(true),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = createVariantSchema
  .partial()
  // Stock count must never be PATCHed directly — adjustments go through stock-adjust so
  // every change writes an InventoryEvent row.
  .omit({ stockCount: true });
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const matrixCreateSchema = z
  .object({
    axes: z.object({
      size: z.array(z.string().min(1).max(40)).max(20).optional(),
      color: z.array(z.string().min(1).max(40)).max(20).optional(),
    }),
    skuPrefix: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Prefix must be uppercase letters/digits with hyphens'),
    defaults: z
      .object({
        stockCount: z.number().int().nonnegative().default(0),
        lowStockThreshold: z.number().int().nonnegative().default(3),
        priceOverridePaisa: paisaSchema.nullish(),
      })
      .default({ stockCount: 0, lowStockThreshold: 3 }),
  })
  .refine(
    (v) => (v.axes.size?.length ?? 0) + (v.axes.color?.length ?? 0) > 0,
    'At least one axis (size or color) must have values',
  );
export type MatrixCreateInput = z.infer<typeof matrixCreateSchema>;

export const stockAdjustSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta must be non-zero'),
  changeType: z.enum([
    INVENTORY_CHANGE_TYPE.STORE_SALE,
    INVENTORY_CHANGE_TYPE.ONLINE_ORDER,
    INVENTORY_CHANGE_TYPE.RESTOCK,
    INVENTORY_CHANGE_TYPE.RETURN_RESTOCK,
    INVENTORY_CHANGE_TYPE.CORRECTION,
    INVENTORY_CHANGE_TYPE.WRITE_OFF,
  ]),
  note: z.string().max(500).optional(),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().min(1).max(200).optional(),
  lowStockOnly: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
});
export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;

// =====================================================
// Public catalog (Sprint 3) — anonymous endpoints feeding the storefront.
// These reuse the admin Zod query shapes where possible but expose a narrower
// response (no cost, no admin-only flags, only active rows).
// =====================================================

// Sort options exposed on the public list endpoint. 'featured' is admin's chosen order
// (sortOrder on the category-product join, falling back to product.updatedAt). 'new'
// sorts by createdAt desc. 'price-asc' / 'price-desc' sort by basePricePaisa.
export const publicSortSchema = z.enum(['featured', 'new', 'price-asc', 'price-desc']);
export type PublicSort = z.infer<typeof publicSortSchema>;

export const publicProductListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(48).default(24),
  q: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(120).optional(), // category slug
  size: z.string().trim().min(1).max(40).optional(),
  color: z.string().trim().min(1).max(40).optional(),
  minPricePaisa: z.coerce.number().int().nonnegative().optional(),
  maxPricePaisa: z.coerce.number().int().nonnegative().optional(),
  // Surface only online-shippable (default), or include in-store-only items.
  includeInStore: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  sort: publicSortSchema.default('featured'),
});
export type PublicProductListQuery = z.infer<typeof publicProductListQuerySchema>;

// Pincode serviceability — owner allowlist stored in Settings under key
// `serviceable_pincodes`. Shape: { prefixes: ['56','110'], exact: ['797112'] }.
// Prefixes match any pincode starting with the value (so '56' covers all of Karnataka).
export const serviceablePincodesSettingSchema = z.object({
  prefixes: z.array(z.string().regex(/^\d{1,5}$/)).default([]),
  exact: z.array(pincodeSchema).default([]),
});
export type ServeablePincodesSetting = z.infer<typeof serviceablePincodesSettingSchema>;

export const serviceabilityQuerySchema = z.object({
  pincode: pincodeSchema,
});
export type ServiceabilityQuery = z.infer<typeof serviceabilityQuerySchema>;

export const serviceabilityResponseSchema = z.object({
  pincode: pincodeSchema,
  serviceable: z.boolean(),
  // ETA window for the storefront delivery widget. Null when not serviceable.
  // Days are calendar days from today; storefront computes the date in IST.
  etaDaysMin: z.number().int().positive().nullable(),
  etaDaysMax: z.number().int().positive().nullable(),
  // Hint copy the widget renders ("Free delivery over ₹1,499", etc.).
  cod: z.boolean(),
  freeShippingThresholdPaisa: z.number().int().nonnegative().nullable(),
});
export type ServiceabilityResponse = z.infer<typeof serviceabilityResponseSchema>;
