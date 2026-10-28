'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createProductAction } from './actions';
import type { ParseResponse, ParsedRow } from '@/app/api/import/products/route';

interface ImportPanelProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

interface ImportResult {
  created: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

export function ImportPanel({ open, onClose, onDone }: ImportPanelProps) {
  const [step, setStep] = React.useState<Step>('upload');
  const [parsing, setParsing] = React.useState(false);
  const [parseResult, setParseResult] = React.useState<ParseResponse | null>(null);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragRef = React.useRef<HTMLDivElement>(null);

  // Reset when panel opens.
  React.useEffect(() => {
    if (open) {
      setStep('upload');
      setParsing(false);
      setParseResult(null);
      setProgress({ done: 0, total: 0 });
      setResult(null);
    }
  }, [open]);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Please upload a .xlsx file');
      return;
    }
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/products', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { error?: string }).error ?? 'Parse failed');
        return;
      }
      const data: ParseResponse = await res.json();
      setParseResult(data);
      setStep('preview');
    } catch {
      toast.error('Could not reach the server — try again');
    } finally {
      setParsing(false);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }

  async function runImport() {
    if (!parseResult) return;
    const validRows = parseResult.rows.filter((r) => r.errors.length === 0 && r.product);
    setProgress({ done: 0, total: validRows.length });
    setStep('importing');

    const errors: ImportResult['errors'] = [];
    let created = 0;

    for (const row of validRows) {
      const p = row.product!;
      const res = await createProductAction({
        slug: p.slug,
        name: p.name,
        description: p.description || undefined,
        hsnCode: p.hsnCode || undefined,
        gstRatePercent: p.gstRatePercent ?? undefined,
        availabilityFlag: p.availabilityFlag,
        basePricePaisa: p.basePricePaisa,
        compareAtPricePaisa: p.compareAtPricePaisa ?? undefined,
        costPricePaisa: p.costPricePaisa ?? undefined,
        isActive: p.isActive,
        isReturnable: p.isReturnable,
        seoTitle: p.seoTitle || undefined,
        seoDescription: p.seoDescription || undefined,
        categoryIds: p.categoryIds.length > 0 ? p.categoryIds : undefined,
        variants: p.variants.length > 0
          ? p.variants.map((v) => ({
              sku: v.sku,
              size: v.size || undefined,
              color: v.color || undefined,
              stockCount: v.stock,
              lowStockThreshold: v.lowStockThreshold,
              priceOverridePaisa: v.priceOverridePaisa ?? undefined,
              barcode: v.barcode || undefined,
              isActive: v.isActive,
            }))
          : undefined,
      });

      if (res.ok) {
        created++;
      } else {
        errors.push({ name: p.name, error: res.error ?? 'Unknown error' });
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setResult({ created, failed: errors.length, errors });
    setStep('done');
    if (created > 0) onDone();
  }

  const validCount = parseResult?.totalValid ?? 0;
  const errorCount = parseResult?.totalErrors ?? 0;

  return (
    <Sheet open={open} onOpenChange={(v) => (!v && step !== 'importing' ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Import products</SheetTitle>
          <SheetDescription>
            {step === 'upload' && 'Upload a .xlsx file in the two-sheet format (Products + Variants).'}
            {step === 'preview' && `${validCount} product${validCount === 1 ? '' : 's'} ready${errorCount > 0 ? `, ${errorCount} with errors (will be skipped)` : ''}.`}
            {step === 'importing' && `Importing ${progress.done} of ${progress.total}…`}
            {step === 'done' && `Import complete.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ── Step 1: Upload ─────────────────────────────────────────── */}
          {step === 'upload' && (
            <div
              ref={dragRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 bg-snow p-12 text-center transition-colors hover:border-ink-900 hover:bg-ink-50"
            >
              {parsing ? (
                <p className="text-[13px] text-ink-500">Parsing file…</p>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-ink-300" />
                  <p className="text-[14px] font-medium text-ink-900">Drop your .xlsx here</p>
                  <p className="text-[12.5px] text-ink-400">or click to browse</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={onFileInputChange}
              />
            </div>
          )}

          {/* ── Step 2: Preview ────────────────────────────────────────── */}
          {step === 'preview' && parseResult && (
            <div className="space-y-3">
              {parseResult.unknownCategorySlugs.length > 0 && (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
                  <strong>Unknown categories</strong> (will be skipped):{' '}
                  {parseResult.unknownCategorySlugs.join(', ')}
                </div>
              )}
              {parseResult.rows.map((row) => (
                <PreviewRow key={row.rowIndex} row={row} />
              ))}
            </div>
          )}

          {/* ── Step 3: Importing ──────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-ink-900 transition-all duration-300"
                  style={{
                    width: progress.total > 0
                      ? `${Math.round((progress.done / progress.total) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
              <p className="text-[13px] text-ink-500">
                {progress.done} of {progress.total} products created…
              </p>
            </div>
          )}

          {/* ── Step 4: Done ───────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-green-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <p className="text-[13px] text-green-800">
                  <strong>{result.created}</strong> product{result.created === 1 ? '' : 's'} created successfully.
                </p>
              </div>
              {result.failed > 0 && (
                <div className="space-y-2">
                  <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <p className="text-[13px] text-red-800">
                      <strong>{result.failed}</strong> product{result.failed === 1 ? '' : 's'} failed to import.
                    </p>
                  </div>
                  <div className="divide-y divide-ink-100 rounded-xl border border-ink-200">
                    {result.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2.5">
                        <p className="text-[12.5px] font-medium text-ink-900">{e.name}</p>
                        <p className="text-[11.5px] text-red-600">{e.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter>
          {step === 'upload' && (
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={runImport} disabled={validCount === 0}>
                Import {validCount} product{validCount === 1 ? '' : 's'}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={onClose}>Done</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Preview row ──────────────────────────────────────────────────────────────

function PreviewRow({ row }: { row: ParsedRow }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasIssues = row.errors.length > 0 || row.warnings.length > 0;
  const isValid = row.errors.length === 0;

  return (
    <div
      className={`rounded-xl border ${isValid ? 'border-ink-200' : 'border-red-200 bg-red-50/40'}`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => hasIssues && setExpanded((v) => !v)}
      >
        {isValid ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-900">
          {row.displayName}
        </span>
        {row.product && (
          <span className="shrink-0 font-mono text-[11px] text-ink-400">
            {row.product.variants.length} variant{row.product.variants.length === 1 ? '' : 's'}
          </span>
        )}
        {hasIssues && (
          <span className="shrink-0 text-ink-400">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
      </button>
      {expanded && hasIssues && (
        <div className="border-t border-red-100 px-4 pb-3 pt-2 space-y-1">
          {row.errors.map((e, i) => (
            <p key={i} className="text-[12px] text-red-700">✗ {e}</p>
          ))}
          {row.warnings.map((w, i) => (
            <p key={i} className="text-[12px] text-amber-700">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
