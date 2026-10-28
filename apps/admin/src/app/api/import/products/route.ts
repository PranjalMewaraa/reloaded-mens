import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ─── Public types (consumed by the import panel) ─────────────────────────────

export interface ParsedVariant {
  sku: string;
  size: string;
  color: string;
  stock: number;
  lowStockThreshold: number;
  priceOverridePaisa: number | null;
  barcode: string;
  isActive: boolean;
}

export interface ParsedProduct {
  name: string;
  slug: string;
  basePricePaisa: number;
  compareAtPricePaisa: number | null;
  costPricePaisa: number | null;
  description: string;
  availabilityFlag: 'online_shippable' | 'in_store_only' | 'both';
  isActive: boolean;
  isReturnable: boolean;
  gstRatePercent: number | null;
  hsnCode: string;
  categoryIds: string[];
  seoTitle: string;
  seoDescription: string;
  variants: ParsedVariant[];
}

export interface ParsedRow {
  rowIndex: number;          // 1-based row in the Products sheet
  displayName: string;       // best-effort name for the preview even if invalid
  product: ParsedProduct | null;
  errors: string[];
  warnings: string[];
}

export interface ParseResponse {
  rows: ParsedRow[];
  totalValid: number;
  totalErrors: number;
  unknownCategorySlugs: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface CategoryItem {
  id: string;
  slug: string;
  children: CategoryItem[];
}

function flattenCatTree(nodes: CategoryItem[]): Map<string, string> {
  const m = new Map<string, string>();
  function walk(list: CategoryItem[]) {
    for (const n of list) { m.set(n.slug, n.id); walk(n.children); }
  }
  walk(nodes);
  return m;
}

// Pull a cell value out as a plain string / number / boolean regardless of
// ExcelJS's union type (can be RichText, formula, Date, etc.).
function cellStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    // RichText
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    // Formula result
    if ('result' in v) return String((v as { result: unknown }).result ?? '');
    // Date
    if (v instanceof Date) return v.toISOString();
    return '';
  }
  return String(v);
}

function cellNum(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function cellBool(cell: ExcelJS.Cell, defaultVal: boolean): boolean {
  const v = cell.value;
  if (v == null || v === '') return defaultVal;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return defaultVal;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// Convert rupees (number) → paisa (integer), rounding to nearest paisa.
function rupeesToPaisa(r: number): number {
  return Math.round(r * 100);
}

const VALID_GST = new Set([0, 5, 12, 18, 28]);
const AVAIL_MAP: Record<string, 'online_shippable' | 'in_store_only' | 'both'> = {
  online: 'online_shippable',
  online_shippable: 'online_shippable',
  store: 'in_store_only',
  in_store_only: 'in_store_only',
  both: 'both',
};
const SKU_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

// ─── Build a header-name → column-number map from row 1 ───────────────────────

function buildHeaderMap(row: ExcelJS.Row): Map<string, number> {
  const m = new Map<string, number>();
  row.eachCell({ includeEmpty: false }, (cell, colNum) => {
    const name = String(cell.value ?? '').trim().toLowerCase().replace(/\s*\*$/, '');
    if (name) m.set(name, colNum);
  });
  return m;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth probe
  const probe = await api('/products?limit=1');
  if (probe.status === 401 || probe.status === 403) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const arrayBuffer = await (file as File).arrayBuffer();

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(arrayBuffer);
  } catch {
    return NextResponse.json({ error: 'Could not parse file — make sure it is a valid .xlsx' }, { status: 400 });
  }

  // Fetch category tree for slug → id resolution
  const catRes = await api<{ items: CategoryItem[] }>('/categories');
  const catSlugToId = catRes.ok && catRes.body
    ? flattenCatTree(catRes.body.items)
    : new Map<string, string>();

  // ── Parse Variants sheet first → group by product_slug ──────────────────────
  const variantsBySlug = new Map<string, ParsedVariant[]>();
  const seenSkus = new Set<string>();

  const ws2 = wb.getWorksheet('Variants');
  if (ws2) {
    const h2 = buildHeaderMap(ws2.getRow(1));
    const col2 = (name: string) => h2.get(name) ?? -1;

    ws2.eachRow({ includeEmpty: false }, (row, ri) => {
      if (ri === 1) return; // header
      const prodSlug = cellStr(row.getCell(col2('product_slug'))).trim();
      const sku = cellStr(row.getCell(col2('sku'))).trim().toUpperCase();
      if (!prodSlug || !sku) return;

      const priceRs = cellNum(row.getCell(col2('price_override')));
      const v: ParsedVariant = {
        sku,
        size: cellStr(row.getCell(col2('size'))).trim(),
        color: cellStr(row.getCell(col2('color'))).trim(),
        stock: Math.max(0, Math.round(cellNum(row.getCell(col2('stock'))) ?? 0)),
        lowStockThreshold: Math.max(0, Math.round(cellNum(row.getCell(col2('low_stock_threshold'))) ?? 3)),
        priceOverridePaisa: priceRs != null && priceRs > 0 ? rupeesToPaisa(priceRs) : null,
        barcode: cellStr(row.getCell(col2('barcode'))).trim(),
        isActive: cellBool(row.getCell(col2('is_active')), true),
      };

      // Track duplicate SKUs across the whole file
      if (!seenSkus.has(sku)) seenSkus.add(sku);

      const list = variantsBySlug.get(prodSlug) ?? [];
      list.push(v);
      variantsBySlug.set(prodSlug, list);
    });
  }

  // ── Parse Products sheet ─────────────────────────────────────────────────────
  const ws1 = wb.getWorksheet('Products');
  if (!ws1) {
    return NextResponse.json({ error: 'No "Products" sheet found in the file' }, { status: 400 });
  }

  const h1 = buildHeaderMap(ws1.getRow(1));
  const col1 = (name: string) => h1.get(name) ?? -1;

  const rows: ParsedRow[] = [];
  const unknownCatSlugs = new Set<string>();
  const seenProductSlugs = new Set<string>();

  ws1.eachRow({ includeEmpty: false }, (row, ri) => {
    if (ri <= 2) return; // row 1 = header, row 2 = optional notes row

    const rawName = cellStr(row.getCell(col1('name'))).trim();
    const rawSlug = cellStr(row.getCell(col1('slug'))).trim();
    const slug = rawSlug || slugify(rawName);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!rawName) errors.push('name is required');

    const basePriceRs = cellNum(row.getCell(col1('base_price')));
    if (basePriceRs == null || basePriceRs <= 0) {
      errors.push('base_price is required and must be a positive number');
    }

    // Duplicate slug check within this import
    if (slug && seenProductSlugs.has(slug)) {
      errors.push(`Duplicate slug "${slug}" — each product must have a unique slug`);
    }
    if (slug) seenProductSlugs.add(slug);

    // Availability
    const rawAvail = cellStr(row.getCell(col1('availability'))).trim().toLowerCase();
    let availabilityFlag: 'online_shippable' | 'in_store_only' | 'both' = 'online_shippable';
    if (rawAvail && !AVAIL_MAP[rawAvail]) {
      errors.push(`availability must be "online", "store", or "both" (got "${rawAvail}")`);
    } else if (rawAvail) {
      availabilityFlag = AVAIL_MAP[rawAvail];
    }

    // GST rate
    const rawGst = cellNum(row.getCell(col1('gst_rate')));
    if (rawGst != null && !VALID_GST.has(rawGst)) {
      errors.push(`gst_rate must be one of 0, 5, 12, 18, 28 (got ${rawGst})`);
    }

    // Categories
    const rawCats = cellStr(row.getCell(col1('categories'))).trim();
    const categoryIds: string[] = [];
    if (rawCats) {
      for (const s of rawCats.split(',').map((x) => x.trim()).filter(Boolean)) {
        const id = catSlugToId.get(s);
        if (id) {
          categoryIds.push(id);
        } else {
          unknownCatSlugs.add(s);
          warnings.push(`Unknown category slug "${s}" — will be skipped`);
        }
      }
    }

    // Variants for this product
    const variants = variantsBySlug.get(slug) ?? [];
    const variantErrors: string[] = [];
    const skusSeen = new Set<string>();
    for (const v of variants) {
      if (!SKU_RE.test(v.sku)) {
        variantErrors.push(`SKU "${v.sku}" must be uppercase letters and digits with hyphens only`);
      }
      if (skusSeen.has(v.sku)) {
        variantErrors.push(`Duplicate SKU "${v.sku}" within this product`);
      }
      skusSeen.add(v.sku);
    }
    errors.push(...variantErrors);

    const cmpRs = cellNum(row.getCell(col1('compare_at_price')));
    const costRs = cellNum(row.getCell(col1('cost_price')));

    const product: ParsedProduct | null = errors.length === 0 ? {
      name: rawName,
      slug,
      basePricePaisa: rupeesToPaisa(basePriceRs!),
      compareAtPricePaisa: cmpRs != null && cmpRs > 0 ? rupeesToPaisa(cmpRs) : null,
      costPricePaisa: costRs != null && costRs > 0 ? rupeesToPaisa(costRs) : null,
      description: cellStr(row.getCell(col1('description'))).trim(),
      availabilityFlag,
      isActive: cellBool(row.getCell(col1('is_active')), true),
      isReturnable: cellBool(row.getCell(col1('is_returnable')), true),
      gstRatePercent: rawGst ?? null,
      hsnCode: cellStr(row.getCell(col1('hsn_code'))).trim(),
      categoryIds,
      seoTitle: cellStr(row.getCell(col1('seo_title'))).trim(),
      seoDescription: cellStr(row.getCell(col1('seo_description'))).trim(),
      variants,
    } : null;

    rows.push({ rowIndex: ri, displayName: rawName || `Row ${ri}`, product, errors, warnings });
  });

  const totalValid = rows.filter((r) => r.errors.length === 0).length;
  const totalErrors = rows.filter((r) => r.errors.length > 0).length;

  return NextResponse.json<ParseResponse>({
    rows,
    totalValid,
    totalErrors,
    unknownCategorySlugs: Array.from(unknownCatSlugs),
  });
}
