import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ChangeType =
  | 'restock'
  | 'correction'
  | 'write_off'
  | 'return_restock'
  | 'store_sale'
  | 'online_order';

export interface ParsedAdjustment {
  variantId: string;
  sku: string;
  productName: string;
  currentStock: number;
  delta: number;
  changeType: ChangeType;
  note: string;
}

export interface AdjustRow {
  rowIndex: number;
  sku: string;          // best-effort for display even if invalid
  adjustment: ParsedAdjustment | null;
  errors: string[];
}

export interface StockAdjustParseResponse {
  rows: AdjustRow[];
  totalValid: number;
  totalErrors: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface VariantListItem {
  id: string;
  sku: string;
  stockCount: number;
  product: { id: string; name: string };
}

async function fetchAllVariants(): Promise<Map<string, VariantListItem>> {
  const map = new Map<string, VariantListItem>();
  let page = 1;
  while (true) {
    const res = await api<{ items: VariantListItem[]; total: number }>(
      `/variants?limit=100&page=${page}`,
    );
    if (!res.ok || !res.body || res.body.items.length === 0) break;
    for (const v of res.body.items) map.set(v.sku.toUpperCase(), v);
    if (map.size >= res.body.total) break;
    page++;
  }
  return map;
}

function cellStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return String((v as { result: unknown }).result ?? '');
    return '';
  }
  return String(v).trim();
}

function cellNum(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function buildHeaderMap(row: ExcelJS.Row): Map<string, number> {
  const m = new Map<string, number>();
  row.eachCell({ includeEmpty: false }, (cell, colNum) => {
    const name = String(cell.value ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/_?\*$/, '');
    if (name) m.set(name, colNum);
  });
  return m;
}

// Accept common aliases so the sheet is human-friendly.
const CHANGE_TYPE_ALIASES: Record<string, ChangeType> = {
  restock: 'restock',
  restocking: 'restock',
  correction: 'correction',
  adjust: 'correction',
  write_off: 'write_off',
  writeoff: 'write_off',
  damage: 'write_off',
  damaged: 'write_off',
  return_restock: 'return_restock',
  return: 'return_restock',
  store_sale: 'store_sale',
  store: 'store_sale',
  pos: 'store_sale',
  online_order: 'online_order',
  online: 'online_order',
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const probe = await api('/variants?limit=1');
  if (probe.status === 401 || probe.status === 403) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const arrayBuffer = await (file as File).arrayBuffer();
  const buffer = Buffer.from(new Uint8Array(arrayBuffer));
  const wb = new ExcelJS.Workbook();
  const tmpPath = join(tmpdir(), `import-stock-${randomUUID()}.xlsx`);
  try {
    await writeFile(tmpPath, buffer);
    await wb.xlsx.readFile(tmpPath);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not parse file — make sure it is a valid .xlsx (${e instanceof Error ? e.message : String(e)})` },
      { status: 400 },
    );
  } finally {
    await unlink(tmpPath).catch(() => {});
  }

  // Find the sheet — accept "Stock Adjustments", "Adjustments", or the first sheet.
  const ws =
    wb.getWorksheet('Stock Adjustments') ??
    wb.getWorksheet('Adjustments') ??
    wb.worksheets[0];

  if (!ws) {
    return NextResponse.json({ error: 'No worksheet found in the file' }, { status: 400 });
  }

  // Build SKU → variant lookup from all live variants.
  const variantBySku = await fetchAllVariants();

  const h = buildHeaderMap(ws.getRow(1));
  const col = (name: string) => h.get(name) ?? 9999;

  const rows: AdjustRow[] = [];

  ws.eachRow({ includeEmpty: false }, (row, ri) => {
    if (ri === 1) return;

    const rawSku = cellStr(row.getCell(col('sku'))).toUpperCase();
    const errors: string[] = [];

    if (!rawSku) { errors.push('sku is required'); }

    // Delta
    const rawDelta = cellNum(row.getCell(col('delta')));
    if (rawDelta == null) {
      errors.push('delta is required and must be a number');
    } else if (!Number.isInteger(rawDelta)) {
      errors.push('delta must be a whole number (no decimals)');
    } else if (rawDelta === 0) {
      errors.push('delta must be non-zero');
    }

    // Change type
    const rawType = cellStr(row.getCell(col('change_type'))).toLowerCase().replace(/\s+/g, '_');
    const changeType: ChangeType | undefined = CHANGE_TYPE_ALIASES[rawType];
    if (!rawType) {
      errors.push('change_type is required');
    } else if (!changeType) {
      errors.push(
        `change_type "${rawType}" is not recognised — use one of: restock, correction, write_off, return_restock, store_sale, online_order`,
      );
    }

    // Note
    const note = cellStr(row.getCell(col('note')));
    if (note.length > 500) {
      errors.push('note must be 500 characters or fewer');
    }

    // SKU lookup (only if other fields are valid so we don't pile on errors)
    const variant = rawSku ? variantBySku.get(rawSku) : undefined;
    if (rawSku && errors.length === 0 && !variant) {
      errors.push(`SKU "${rawSku}" not found in this catalogue`);
    }

    const adjustment: ParsedAdjustment | null =
      errors.length === 0 && variant && changeType != null
        ? {
            variantId: variant.id,
            sku: rawSku,
            productName: variant.product.name,
            currentStock: variant.stockCount,
            delta: rawDelta!,
            changeType,
            note: note.slice(0, 500),
          }
        : null;

    rows.push({ rowIndex: ri, sku: rawSku || `Row ${ri}`, adjustment, errors });
  });

  const totalValid = rows.filter((r) => r.errors.length === 0).length;
  const totalErrors = rows.filter((r) => r.errors.length > 0).length;

  return NextResponse.json<StockAdjustParseResponse>({ rows, totalValid, totalErrors });
}
