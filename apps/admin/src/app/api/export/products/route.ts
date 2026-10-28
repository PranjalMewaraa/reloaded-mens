import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ─── shape mirrors what the API returns ─────────────────────────────────────

interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  availabilityFlag: string;
  isActive: boolean;
  variantCount: number;
  updatedAt: string;
}

interface Variant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  priceOverridePaisa: number | null;
  stockCount: number;
  lowStockThreshold: number;
  barcode: string | null;
  isActive: boolean;
}

interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  hsnCode: string | null;
  gstRatePercent: number | null;
  availabilityFlag: string;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  costPricePaisa: number | null;
  isActive: boolean;
  isReturnable: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCategories: Array<{ categoryId: string }>;
  variants: Variant[];
}

interface CategoryItem {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  children: CategoryItem[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function paisa(v: number | null | undefined): number | '' {
  return v != null ? v / 100 : '';
}

function availLabel(flag: string): string {
  if (flag === 'in_store_only') return 'store';
  if (flag === 'both') return 'both';
  return 'online';
}

function flattenCategories(nodes: CategoryItem[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(list: CategoryItem[]) {
    for (const n of list) {
      map.set(n.id, n.slug);
      walk(n.children);
    }
  }
  walk(nodes);
  return map;
}

// Fetch every page of products up to maxProducts (hard cap to avoid runaway).
async function fetchAllProducts(
  filters: { q?: string; isActive?: string },
  maxProducts = 2000,
): Promise<ProductListItem[]> {
  const all: ProductListItem[] = [];
  let page = 1;
  const limit = 100;
  while (all.length < maxProducts) {
    const qs = new URLSearchParams({ limit: String(limit), page: String(page) });
    if (filters.q) qs.set('q', filters.q);
    if (filters.isActive) qs.set('isActive', filters.isActive);
    const res = await api<{ items: ProductListItem[]; total: number }>(`/products?${qs}`);
    if (!res.ok || !res.body || res.body.items.length === 0) break;
    all.push(...res.body.items);
    if (all.length >= res.body.total) break;
    page++;
  }
  return all;
}

// Fetch product details in parallel batches.
async function fetchDetails(ids: string[], batchSize = 10): Promise<ProductDetail[]> {
  const results: ProductDetail[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((id) => api<ProductDetail>(`/products/${id}`)),
    );
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value.ok && s.value.body) {
        results.push(s.value.body);
      }
    }
  }
  return results;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  // Auth check — a 401 from /products means the session is gone.
  const probe = await api<{ items: ProductListItem[] }>('/products?limit=1');
  if (probe.status === 401 || probe.status === 403) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Fetch everything in parallel (products list + category tree).
  const [products, categoriesRes] = await Promise.all([
    fetchAllProducts({ q: sp.get('q') ?? undefined, isActive: sp.get('isActive') ?? undefined }),
    api<{ items: CategoryItem[] }>('/categories'),
  ]);

  const catSlugById =
    categoriesRes.ok && categoriesRes.body
      ? flattenCategories(categoriesRes.body.items)
      : new Map<string, string>();

  const details = await fetchDetails(products.map((p) => p.id));

  // ── Build workbook ─────────────────────────────────────────────────────────

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reloaded Mens Admin';
  wb.created = new Date();

  // ── Sheet 1: Products ──────────────────────────────────────────────────────

  const ws1 = wb.addWorksheet('Products');
  ws1.columns = [
    { header: 'name',               key: 'name',               width: 36 },
    { header: 'slug',               key: 'slug',               width: 36 },
    { header: 'base_price',         key: 'base_price',         width: 14 },
    { header: 'compare_at_price',   key: 'compare_at_price',   width: 18 },
    { header: 'cost_price',         key: 'cost_price',         width: 14 },
    { header: 'description',        key: 'description',        width: 50 },
    { header: 'availability',       key: 'availability',       width: 16 },
    { header: 'is_active',          key: 'is_active',          width: 12 },
    { header: 'is_returnable',      key: 'is_returnable',      width: 14 },
    { header: 'gst_rate',           key: 'gst_rate',           width: 10 },
    { header: 'hsn_code',           key: 'hsn_code',           width: 14 },
    { header: 'categories',         key: 'categories',         width: 36 },
    { header: 'seo_title',          key: 'seo_title',          width: 30 },
    { header: 'seo_description',    key: 'seo_description',    width: 50 },
  ];

  // Bold header row.
  ws1.getRow(1).font = { bold: true };
  ws1.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };

  for (const p of details) {
    const slugs = (p.productCategories ?? [])
      .map((pc) => catSlugById.get(pc.categoryId))
      .filter(Boolean)
      .join(',');

    ws1.addRow({
      name:             p.name,
      slug:             p.slug,
      base_price:       paisa(p.basePricePaisa),
      compare_at_price: paisa(p.compareAtPricePaisa),
      cost_price:       paisa(p.costPricePaisa),
      description:      p.description ?? '',
      availability:     availLabel(p.availabilityFlag),
      is_active:        p.isActive,
      is_returnable:    p.isReturnable,
      gst_rate:         p.gstRatePercent ?? '',
      hsn_code:         p.hsnCode ?? '',
      categories:       slugs,
      seo_title:        p.seoTitle ?? '',
      seo_description:  p.seoDescription ?? '',
    });
  }

  // ── Sheet 2: Variants ──────────────────────────────────────────────────────

  const ws2 = wb.addWorksheet('Variants');
  ws2.columns = [
    { header: 'product_slug',    key: 'product_slug',    width: 36 },
    { header: 'sku',             key: 'sku',             width: 20 },
    { header: 'size',            key: 'size',            width: 10 },
    { header: 'color',           key: 'color',           width: 14 },
    { header: 'stock',           key: 'stock',           width: 10 },
    { header: 'low_stock_threshold', key: 'low_stock_threshold', width: 20 },
    { header: 'price_override',  key: 'price_override',  width: 16 },
    { header: 'barcode',         key: 'barcode',         width: 18 },
    { header: 'is_active',       key: 'is_active',       width: 12 },
  ];

  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };

  for (const p of details) {
    for (const v of p.variants ?? []) {
      ws2.addRow({
        product_slug:        p.slug,
        sku:                 v.sku,
        size:                v.size ?? '',
        color:               v.color ?? '',
        stock:               v.stockCount,
        low_stock_threshold: v.lowStockThreshold,
        price_override:      paisa(v.priceOverridePaisa),
        barcode:             v.barcode ?? '',
        is_active:           v.isActive,
      });
    }
  }

  // ── Serialize and return ───────────────────────────────────────────────────

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `products-${date}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
