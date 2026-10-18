import { z } from 'zod';

// ─── Request schemas ────────────────────────────────────────────────

export const posOrderItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});

export const createPosOrderSchema = z.object({
  items: z.array(posOrderItemSchema).min(1, 'Cart must have at least one item'),
  customerPhone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Phone must be in +91XXXXXXXXXX format'),
  customerName: z.string().min(1).max(100).optional(),
  customerEmail: z.string().email().optional(),
  couponCode: z.string().optional(),
});

// ─── Response schemas ───────────────────────────────────────────────

export const posProductVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  label: z.string(), // 'M · Black'
  pricePaisa: z.number(),
  stockCount: z.number(),
  isActive: z.boolean(),
});

export const posProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  imageUrl: z.string().nullable(),
  variants: z.array(posProductVariantSchema),
});

export const posProductSearchResponseSchema = z.object({
  products: z.array(posProductSchema),
  total: z.number(),
});

export const posOrderCreatedSchema = z.object({
  orderNumber: z.string(),
  totalPaisa: z.number(),
  discountPaisa: z.number(),
  billPdfUrl: z.string(),
  whatsappUrl: z.string(), // pre-built wa.me URL
  customerPhone: z.string(),
  customerName: z.string().nullable(),
  createdAt: z.string(),
});

export const posOrderListItemSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerName: z.string().nullable(),
  customerPhone: z.string(),
  totalPaisa: z.number(),
  itemCount: z.number(),
  billPdfUrl: z.string().nullable(),
  whatsappUrl: z.string().nullable(),
  createdAt: z.string(),
});

export const posOrderListResponseSchema = z.object({
  orders: z.array(posOrderListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const posSettingsSchema = z.object({
  upiId: z.string(),
  upiDisplayName: z.string(),
  billFooterNote: z.string(),
  storeName: z.string(),
  storeAddress: z.string(),
  storePhone: z.string(),
});

export const posOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // 'today' | 'week' | 'all'
  period: z.enum(['today', 'week', 'all']).default('today'),
});

// ─── Inferred types ─────────────────────────────────────────────────

export type PosOrderItem = z.infer<typeof posOrderItemSchema>;
export type CreatePosOrderRequest = z.infer<typeof createPosOrderSchema>;
export type PosProduct = z.infer<typeof posProductSchema>;
export type PosProductVariant = z.infer<typeof posProductVariantSchema>;
export type PosProductSearchResponse = z.infer<typeof posProductSearchResponseSchema>;
export type PosOrderCreated = z.infer<typeof posOrderCreatedSchema>;
export type PosOrderListItem = z.infer<typeof posOrderListItemSchema>;
export type PosOrderListResponse = z.infer<typeof posOrderListResponseSchema>;
export type PosSettings = z.infer<typeof posSettingsSchema>;
export type PosOrderListQuery = z.infer<typeof posOrderListQuerySchema>;
