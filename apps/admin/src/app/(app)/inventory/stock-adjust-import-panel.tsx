'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
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
import { adjustVariantStockAction } from '../products/[id]/actions';
import type { StockAdjustParseResponse, AdjustRow } from '@/app/api/import/stock-adjust/route';

interface StockAdjustImportPanelProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

interface ImportResult {
  applied: number;
  failed: number;
  errors: Array<{ sku: string; error: string }>;
}

export function StockAdjustImportPanel({
  open,
  onClose,
  onDone,
}: StockAdjustImportPanelProps) {
  const [step, setStep] = React.useState<Step>('upload');
  const [parsing, setParsing] = React.useState(false);
  const [parseResult, setParseResult] = React.useState<StockAdjustParseResponse | null>(null);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      const res = await fetch('/api/import/stock-adjust', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { error?: string }).error ?? 'Parse failed');
        return;
      }
      const data: StockAdjustParseResponse = await res.json();
      setParseResult(data);
      setStep('preview');
    } catch {
      toast.error('Could not reach the server — try again');
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!parseResult) return;
    const validRows = parseResult.rows.filter((r) => r.errors.length === 0 && r.adjustment);
    setProgress({ done: 0, total: validRows.length });
    setStep('importing');

    const errors: ImportResult['errors'] = [];
    let applied = 0;

    for (const row of validRows) {
      const a = row.adjustment!;
      const res = await adjustVariantStockAction(a.variantId, null, {
        delta: a.delta,
        changeType: a.changeType,
        note: a.note || undefined,
      });
      if (res.ok) {
        applied++;
      } else {
        errors.push({ sku: a.sku, error: res.error ?? 'Unknown error' });
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setResult({ applied, failed: errors.length, errors });
    setStep('done');
    if (applied > 0) onDone();
  }

  const validCount = parseResult?.totalValid ?? 0;
  const errorCount = parseResult?.totalErrors ?? 0;

  return (
    <Sheet open={open} onOpenChange={(v) => (!v && step !== 'importing' ? onClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Import stock adjustments</SheetTitle>
          <SheetDescription>
            {step === 'upload' && 'Upload a .xlsx with columns: sku, delta, change_type, note (optional).'}
            {step === 'preview' && `${validCount} adjustment${validCount === 1 ? '' : 's'} ready${errorCount > 0 ? `, ${errorCount} with errors (will be skipped)` : ''}.`}
            {step === 'importing' && `Applying ${progress.done} of ${progress.total}…`}
            {step === 'done' && 'Import complete.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Step 1: Upload ─────────────────────────────────────────── */}
          {step === 'upload' && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
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
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
                />
              </div>

              {/* Format reference */}
              <div className="mt-6 rounded-xl border border-ink-200 bg-snow">
                <p className="border-b border-ink-100 px-4 py-2.5 text-[12px] font-medium text-ink-500 uppercase tracking-wide">
                  Required columns
                </p>
                <div className="divide-y divide-ink-100">
                  {[
                    { col: 'sku', desc: 'Variant SKU — must exist in the catalogue (e.g. SHIRT-BLU-M)' },
                    { col: 'delta', desc: 'Non-zero integer — positive adds stock, negative removes it' },
                    { col: 'change_type', desc: 'restock · correction · write_off · return_restock · store_sale · online_order' },
                    { col: 'note', desc: 'Optional description (≤500 chars)' },
                  ].map(({ col, desc }) => (
                    <div key={col} className="flex gap-3 px-4 py-2.5">
                      <code className="w-32 shrink-0 font-mono text-[11.5px] text-ink-900">{col}</code>
                      <p className="text-[12px] text-ink-500">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Preview ────────────────────────────────────────── */}
          {step === 'preview' && parseResult && (
            <div className="space-y-2">
              {parseResult.rows.map((row) => (
                <AdjustPreviewRow key={row.rowIndex} row={row} />
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
                {progress.done} of {progress.total} adjustments applied…
              </p>
            </div>
          )}

          {/* ── Step 4: Done ───────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-green-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <p className="text-[13px] text-green-800">
                  <strong>{result.applied}</strong> adjustment{result.applied === 1 ? '' : 's'} applied successfully.
                </p>
              </div>
              {result.failed > 0 && (
                <div className="space-y-2">
                  <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <p className="text-[13px] text-red-800">
                      <strong>{result.failed}</strong> adjustment{result.failed === 1 ? '' : 's'} failed.
                    </p>
                  </div>
                  <div className="divide-y divide-ink-100 rounded-xl border border-ink-200">
                    {result.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2.5">
                        <p className="font-mono text-[12px] font-medium text-ink-900">{e.sku}</p>
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
                Apply {validCount} adjustment{validCount === 1 ? '' : 's'}
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

function AdjustPreviewRow({ row }: { row: AdjustRow }) {
  const isValid = row.errors.length === 0;
  const a = row.adjustment;

  return (
    <div className={`rounded-xl border px-4 py-3 ${isValid ? 'border-ink-200' : 'border-red-200 bg-red-50/40'}`}>
      <div className="flex items-center gap-3">
        {isValid ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[13px] font-medium text-ink-900">{row.sku}</span>
            {a && (
              <span className="text-[12px] text-ink-500">{a.productName}</span>
            )}
          </div>
          {a && (
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              Stock {a.currentStock} →{' '}
              <span className={a.delta > 0 ? 'text-green-600' : 'text-red-600'}>
                {a.currentStock + a.delta}
              </span>
              {' '}({a.delta > 0 ? '+' : ''}{a.delta}) · {a.changeType.replace(/_/g, ' ')}
              {a.note ? ` · "${a.note}"` : ''}
            </p>
          )}
        </div>
      </div>
      {row.errors.length > 0 && (
        <div className="mt-2 space-y-0.5 pl-7">
          {row.errors.map((e, i) => (
            <p key={i} className="text-[12px] text-red-700">✗ {e}</p>
          ))}
        </div>
      )}
    </div>
  );
}
