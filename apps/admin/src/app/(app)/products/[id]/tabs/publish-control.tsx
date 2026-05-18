'use client';

// Sprint 9 simplification — Replaces the old "Active" toggle on the Availability
// tab. Big visible state pill + Publish/Unpublish button at the top of the
// editor. Disabled until the readiness checklist passes; tooltip surfaces what's
// missing so the operator doesn't hunt.

import * as React from 'react';
import { Check, CircleAlert, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { updateProductAction } from '../actions';
import type { EditorProduct } from '../product-editor';

interface PublishControlProps {
  draft: EditorProduct;
  // True when there are unsaved local changes — publish actions take effect
  // against the saved record, so we disable when dirty to keep the model simple.
  dirty: boolean;
  productId: string;
  onPublishedChange: (next: boolean) => void;
}

interface ReadinessCheck {
  ok: boolean;
  label: string;
}

function readinessChecks(draft: EditorProduct): ReadinessCheck[] {
  const stockedVariantCount = draft.variants.filter((v) => v.isActive && v.stockCount > 0).length;
  return [
    { ok: draft.name.trim().length > 0 && !draft.name.startsWith('Untitled'), label: 'Real product name' },
    { ok: draft.basePricePaisa > 0, label: 'Base price set' },
    { ok: draft.gstRatePercent !== null && draft.gstRatePercent !== undefined, label: 'GST rate selected' },
    { ok: (draft.hsnCode ?? '').trim().length > 0, label: 'HSN code set' },
    { ok: draft.images.length > 0, label: 'At least 1 image' },
    { ok: stockedVariantCount > 0, label: 'At least 1 variant with stock' },
    { ok: draft.categoryIds.length > 0, label: 'At least 1 category' },
  ];
}

export function PublishControl({ draft, dirty, productId, onPublishedChange }: PublishControlProps) {
  const [busy, setBusy] = React.useState(false);
  const checks = readinessChecks(draft);
  const missing = checks.filter((c) => !c.ok);
  const ready = missing.length === 0;
  const published = draft.isActive;

  // Phase 2b — optimistic flip. Mobile networks routinely take 500-800 ms for
  // a PATCH; the operator shouldn't watch a spinner for that. We tell the
  // parent the new state immediately, then roll back on error.
  async function flip(nextActive: boolean) {
    const previous = published;
    setBusy(true);
    onPublishedChange(nextActive);
    try {
      const res = await updateProductAction(productId, { isActive: nextActive });
      if (!res.ok) {
        onPublishedChange(previous);
        toast.error(res.error ?? 'Could not change publish state');
        return;
      }
      toast.success(nextActive ? 'Product published' : 'Product unpublished');
    } catch (err) {
      onPublishedChange(previous);
      toast.error((err as Error).message || 'Could not change publish state');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {published ? (
          <Pill tone="success" withDot>Published</Pill>
        ) : (
          <Pill tone="neutral" withDot>Draft</Pill>
        )}
        {published ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => flip(false)}
            disabled={busy || dirty}
            title={dirty ? 'Save your changes first' : undefined}
          >
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            Unpublish
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => flip(true)}
            disabled={busy || !ready || dirty}
            title={
              dirty
                ? 'Save your changes first'
                : !ready
                ? `Missing: ${missing.map((m) => m.label).join(', ')}`
                : undefined
            }
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Publish
          </Button>
        )}
      </div>

      {!published ? (
        <details className="w-full max-w-xs rounded-md border border-ink-100 bg-snow p-2 text-[12px] open:bg-ink-50/40">
          <summary className="cursor-pointer list-none font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            Ready to publish? {ready ? '✓ Yes' : `${checks.length - missing.length}/${checks.length}`}
          </summary>
          <ul className="mt-2 space-y-1">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[12px]">
                {c.ok ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <CircleAlert className="h-3 w-3 text-warning" />
                )}
                <span className={c.ok ? 'text-ink-500 line-through' : 'text-ink-900'}>{c.label}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
