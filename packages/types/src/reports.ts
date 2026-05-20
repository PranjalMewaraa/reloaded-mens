// Schemas + DTO shapes for the admin reports endpoints.

import { z } from 'zod';

// Date range query — both fields ISO strings. Defaults applied server-side
// (last 30 days) if neither is provided.
export const reportRangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;

// Headline numbers for the top of the reports dashboard.
export const reportSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  // Sum of paid orders' totals.
  totalRevenuePaisa: z.number().int().nonnegative(),
  // Count of paid orders (state in confirmed..delivered, excluding cancelled/refunded).
  orderCount: z.number().int().nonnegative(),
  // Average order value in paisa. 0 when orderCount=0.
  averageOrderValuePaisa: z.number().int().nonnegative(),
  // Refunded amount in the range (signed positive).
  refundedPaisa: z.number().int().nonnegative(),
  // Count of new customers (first order in range).
  newCustomerCount: z.number().int().nonnegative(),
  // (returns initiated in range) / (orders delivered in range), %.
  returnRatePercent: z.number().nonnegative(),
});
export type ReportSummary = z.infer<typeof reportSummarySchema>;

// One row per day for the sales-by-day series.
export const reportSalesByDayItemSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  revenuePaisa: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
});
export type ReportSalesByDayItem = z.infer<typeof reportSalesByDayItemSchema>;

export const reportSalesByDayResponseSchema = z.object({
  items: z.array(reportSalesByDayItemSchema),
});
export type ReportSalesByDayResponse = z.infer<typeof reportSalesByDayResponseSchema>;

export const reportTopProductItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  unitsSold: z.number().int().nonnegative(),
  revenuePaisa: z.number().int().nonnegative(),
});
export type ReportTopProductItem = z.infer<typeof reportTopProductItemSchema>;

export const reportTopProductsResponseSchema = z.object({
  items: z.array(reportTopProductItemSchema),
});
export type ReportTopProductsResponse = z.infer<typeof reportTopProductsResponseSchema>;

export const reportTopCustomerItemSchema = z.object({
  customerId: z.string(),
  name: z.string().nullable(),
  phone: z.string(),
  email: z.string().nullable(),
  orderCount: z.number().int().nonnegative(),
  totalSpentPaisa: z.number().int().nonnegative(),
});
export type ReportTopCustomerItem = z.infer<typeof reportTopCustomerItemSchema>;

export const reportTopCustomersResponseSchema = z.object({
  items: z.array(reportTopCustomerItemSchema),
});
export type ReportTopCustomersResponse = z.infer<typeof reportTopCustomersResponseSchema>;
